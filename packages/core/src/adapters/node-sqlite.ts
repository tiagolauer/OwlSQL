import type { DatabaseSync, StatementSync } from 'node:sqlite';
import type { DialectExecutor, QueryMeta } from '../index.js';
import { resolveMixedParameters } from './named-params.js';

type SqliteParam = null | number | bigint | string | NodeJS.ArrayBufferView;

const SQLITE_PARAM_PREFIXES: ReadonlySet<string> = new Set(['@', '$', ':']);
const DML_KEYWORDS = new Set(['insert', 'update', 'delete', 'replace']);
const INSERT_ROWID_KEYWORDS = new Set(['insert', 'replace']);
const RESULT_KEYWORDS = new Set(['select', 'values', 'pragma', 'explain', 'with']);
const STATEMENT_KEYWORDS = new Set([...DML_KEYWORDS, ...RESULT_KEYWORDS]);
const RETURNING_KEYWORD = /\breturning\b/i;
const WORD_OR_PAREN = /[()]|[A-Za-z_][A-Za-z0-9_]*/g;
const WRITE_COUNTERS = 'select changes() as changes, last_insert_rowid() as rowid';

function toSqliteValue(value: unknown): SqliteParam {
  if (typeof value === 'boolean') {
    return value ? 1 : 0;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (value === undefined) {
    return null;
  }
  return value as SqliteParam;
}

function skipLiteral(sql: string, openIndex: number): number {
  let index = openIndex + 1;

  while (index < sql.length) {
    if (sql[index] === "'") {
      if (sql[index + 1] === "'") {
        index += 2;
        continue;
      }
      return index + 1;
    }
    index += 1;
  }

  return sql.length;
}

// Blanks literal bodies and comments while keeping every offset, so keyword and
// paren-depth scanning never reads text that isn't executable SQL.
function maskLiteralsAndComments(sql: string): string {
  let masked = '';
  let index = 0;

  while (index < sql.length) {
    const char = sql[index] as string;
    let end = -1;

    if (char === "'") {
      end = skipLiteral(sql, index);
    } else if (char === '-' && sql[index + 1] === '-') {
      const newline = sql.indexOf('\n', index + 2);
      end = newline === -1 ? sql.length : newline;
    } else if (char === '/' && sql[index + 1] === '*') {
      const close = sql.indexOf('*/', index + 2);
      end = close === -1 ? sql.length : close + 2;
    }

    if (end === -1) {
      masked += char;
      index += 1;
      continue;
    }

    masked += ' '.repeat(end - index);
    index = end;
  }

  return masked;
}

// The keyword that decides what the statement *does*. A CTE-led write leads
// with `with`, so reading the first word alone classified `with x as (...)
// insert into t ...` as a read and dropped its row count (issue #237); the
// statement keyword is the first one at paren depth 0 after the WITH clause.
function readStatementKeyword(sql: string): string {
  const masked = maskLiteralsAndComments(sql);
  const leading = /^\s*([A-Za-z_][A-Za-z0-9_]*)/.exec(masked)?.[1]?.toLowerCase() ?? '';

  if (leading !== 'with') {
    return leading;
  }

  let depth = 0;
  WORD_OR_PAREN.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = WORD_OR_PAREN.exec(masked)) !== null) {
    const token = match[0];

    if (token === '(') {
      depth += 1;
      continue;
    }
    if (token === ')') {
      depth -= 1;
      continue;
    }

    const word = token.toLowerCase();
    if (depth === 0 && word !== 'with' && STATEMENT_KEYWORDS.has(word)) {
      return word;
    }
  }

  return leading;
}

function hasResultColumnsFromSql(sql: string): boolean {
  const keyword = readStatementKeyword(sql);
  if (DML_KEYWORDS.has(keyword)) {
    return RETURNING_KEYWORD.test(maskLiteralsAndComments(sql));
  }
  return RESULT_KEYWORDS.has(keyword);
}

function hasResultColumns(statement: StatementSync, sql: string): boolean {
  if (typeof statement.columns !== 'function') {
    return hasResultColumnsFromSql(sql);
  }

  try {
    return statement.columns().length > 0;
  } catch {
    // If metadata introspection itself fails, preserve the old row-returning
    // path instead of risking `run()` on a statement that actually returns rows.
    return true;
  }
}

function buildMeta(keyword: string, changes: number | bigint, rowid: number | bigint): QueryMeta {
  const meta: QueryMeta = {};
  if (DML_KEYWORDS.has(keyword)) {
    meta.rowCount = changes;
  }
  if (INSERT_ROWID_KEYWORDS.has(keyword) && changes !== 0) {
    meta.lastInsertRowid = rowid;
  }
  return meta;
}

function writeMeta(keyword: string, result: ReturnType<StatementSync['run']>): QueryMeta {
  return buildMeta(keyword, result.changes, result.lastInsertRowid);
}

// `all()` returns rows only, so a write with RETURNING has to read the counters
// back off the connection - they still describe the statement that just ran.
// Metadata is the bonus here and the rows are the answer, so a connection that
// won't report them costs the caller its meta, never its result set.
function returningMeta(db: DatabaseSync, keyword: string): QueryMeta {
  try {
    const counters = db.prepare(WRITE_COUNTERS).get() as
      | { changes: number | bigint; rowid: number | bigint }
      | undefined;

    return counters === undefined ? {} : buildMeta(keyword, counters.changes, counters.rowid);
  } catch {
    return {};
  }
}

export function createNodeSqliteExecutor(
  db: DatabaseSync,
): DialectExecutor<'question' | 'at' | 'dollar'> {
  return async (sql, params) => {
    const statement = db.prepare(sql);
    const values = params.map(toSqliteValue);
    const { named, positional } = resolveMixedParameters(sql, SQLITE_PARAM_PREFIXES, values);
    const keyword = readStatementKeyword(sql);
    const hasNamed = Object.keys(named).length > 0;

    if (!hasResultColumns(statement, sql)) {
      const result = hasNamed
        ? statement.run(named as Record<string, SqliteParam>, ...(positional as SqliteParam[]))
        : statement.run(...(positional as SqliteParam[]));
      return {
        rows: [],
        meta: writeMeta(keyword, result),
      };
    }

    const rows = hasNamed
      ? statement.all(named as Record<string, SqliteParam>, ...(positional as SqliteParam[]))
      : statement.all(...(positional as SqliteParam[]));

    if (!DML_KEYWORDS.has(keyword)) {
      return rows;
    }

    return { rows, meta: returningMeta(db, keyword) };
  };
}
