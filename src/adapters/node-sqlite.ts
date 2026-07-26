import type { DatabaseSync, StatementSync } from 'node:sqlite';
import type { DialectExecutor, QueryMeta } from '../index.js';
import { resolveMixedParameters } from './named-params.js';

type SqliteParam = null | number | bigint | string | NodeJS.ArrayBufferView;

const SQLITE_PARAM_PREFIXES: ReadonlySet<string> = new Set(['@', '$', ':']);
const DML_KEYWORDS = new Set(['insert', 'update', 'delete', 'replace']);
const INSERT_ROWID_KEYWORDS = new Set(['insert', 'replace']);
const RESULT_KEYWORDS = new Set(['select', 'values', 'pragma', 'explain', 'with']);

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

function readLeadingKeyword(sql: string): string {
  let rest = sql.trimStart();

  while (rest.startsWith('--') || rest.startsWith('/*')) {
    if (rest.startsWith('--')) {
      const newline = rest.indexOf('\n');
      rest = newline === -1 ? '' : rest.slice(newline + 1).trimStart();
      continue;
    }

    const close = rest.indexOf('*/', 2);
    rest = close === -1 ? '' : rest.slice(close + 2).trimStart();
  }

  return /^[A-Za-z_][A-Za-z0-9_]*/.exec(rest)?.[0]?.toLowerCase() ?? '';
}

function isWordChar(char: string | undefined): boolean {
  return char !== undefined && /[A-Za-z0-9_]/.test(char);
}

function containsKeywordOutsideLiterals(sql: string, keyword: string): boolean {
  for (let index = 0; index < sql.length; index += 1) {
    const char = sql[index];

    if (char === "'") {
      index += 1;
      while (index < sql.length) {
        if (sql[index] === "'") {
          if (sql[index + 1] === "'") {
            index += 2;
            continue;
          }
          break;
        }
        index += 1;
      }
      continue;
    }

    if (char === '-' && sql[index + 1] === '-') {
      const newline = sql.indexOf('\n', index + 2);
      index = newline === -1 ? sql.length : newline;
      continue;
    }

    if (char === '/' && sql[index + 1] === '*') {
      const close = sql.indexOf('*/', index + 2);
      index = close === -1 ? sql.length : close + 1;
      continue;
    }

    if (
      sql.slice(index, index + keyword.length).toLowerCase() === keyword &&
      !isWordChar(sql[index - 1]) &&
      !isWordChar(sql[index + keyword.length])
    ) {
      return true;
    }
  }

  return false;
}

function hasResultColumnsFromSql(sql: string): boolean {
  const keyword = readLeadingKeyword(sql);
  if (DML_KEYWORDS.has(keyword)) {
    return containsKeywordOutsideLiterals(sql, 'returning');
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

function writeMeta(sql: string, result: ReturnType<StatementSync['run']>): QueryMeta {
  const keyword = readLeadingKeyword(sql);
  const meta: QueryMeta = {};
  if (DML_KEYWORDS.has(keyword)) {
    meta.rowCount = result.changes;
  }
  if (INSERT_ROWID_KEYWORDS.has(keyword) && result.changes !== 0) {
    meta.lastInsertRowid = result.lastInsertRowid;
  }
  return meta;
}

export function createNodeSqliteExecutor(
  db: DatabaseSync,
): DialectExecutor<'question' | 'at' | 'dollar'> {
  return async (sql, params) => {
    const statement = db.prepare(sql);
    const values = params.map(toSqliteValue);
    const { named, positional } = resolveMixedParameters(sql, SQLITE_PARAM_PREFIXES, values);

    if (!hasResultColumns(statement, sql)) {
      const result = Object.keys(named).length > 0
        ? statement.run(named as Record<string, SqliteParam>, ...(positional as SqliteParam[]))
        : statement.run(...(positional as SqliteParam[]));
      return {
        rows: [],
        meta: writeMeta(sql, result),
      };
    }

    if (Object.keys(named).length > 0) {
      return statement.all(named as Record<string, SqliteParam>, ...(positional as SqliteParam[]));
    }

    return statement.all(...(positional as SqliteParam[]));
  };
}
