import type { DatabaseSync, StatementSync } from 'node:sqlite';
import type { DialectExecutor } from '../runtime/executor.js';
import type { QueryMeta } from '../runtime/result.js';
import { resolveMixedParameters } from './named-params.js';

type SqliteParam = null | number | bigint | string | NodeJS.ArrayBufferView;

const SQLITE_PARAM_PREFIXES: ReadonlySet<string> = new Set(['@', '$', ':']);
const WRITE_COUNTERS = 'select total_changes() as changes, last_insert_rowid() as rowid';

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

function hasResultColumns(statement: StatementSync): boolean | undefined {
  if (typeof statement.columns !== 'function') {
    return undefined;
  }
  try {
    return statement.columns().length > 0;
  } catch {
    return undefined;
  }
}

interface SqliteCounters {
  changes: number | bigint;
  rowid: number | bigint;
}

function readCounters(db: DatabaseSync): SqliteCounters | undefined {
  try {
    return db.prepare(WRITE_COUNTERS).get() as SqliteCounters | undefined;
  } catch {
    return undefined;
  }
}

function counterDelta(after: number | bigint, before: number | bigint): number | bigint {
  if (typeof after === 'bigint' || typeof before === 'bigint') {
    return BigInt(after) - BigInt(before);
  }
  return after - before;
}

function changed(value: number | bigint): boolean {
  return value !== 0 && value !== 0n;
}

function writeMeta(
  result: ReturnType<StatementSync['run']>,
  before: SqliteCounters | undefined,
): QueryMeta {
  const meta: QueryMeta = { rowCount: result.changes };
  if (
    changed(result.changes) &&
    before !== undefined &&
    result.lastInsertRowid !== before.rowid
  ) {
    meta.lastInsertRowid = result.lastInsertRowid;
  }
  return meta;
}

function returnedRowsMeta(
  before: SqliteCounters | undefined,
  after: SqliteCounters | undefined,
): QueryMeta | undefined {
  if (before === undefined || after === undefined) {
    return undefined;
  }
  const rowCount = counterDelta(after.changes, before.changes);
  if (!changed(rowCount)) {
    return undefined;
  }
  return after.rowid === before.rowid
    ? { rowCount }
    : { rowCount, lastInsertRowid: after.rowid };
}

export function createNodeSqliteExecutor(
  db: DatabaseSync,
): DialectExecutor<'question' | 'at' | 'dollar'> {
  return async (sql, params) => {
    const statement = db.prepare(sql);
    const values = params.map(toSqliteValue);
    const { named, positional } = resolveMixedParameters(sql, SQLITE_PARAM_PREFIXES, values);
    const hasNamed = Object.keys(named).length > 0;
    const returnsRows = hasResultColumns(statement);

    if (returnsRows === undefined) {
      return hasNamed
        ? statement.all(named as Record<string, SqliteParam>, ...(positional as SqliteParam[]))
        : statement.all(...(positional as SqliteParam[]));
    }

    const before = readCounters(db);

    if (returnsRows === false) {
      const result = hasNamed
        ? statement.run(named as Record<string, SqliteParam>, ...(positional as SqliteParam[]))
        : statement.run(...(positional as SqliteParam[]));
      return {
        rows: [],
        meta: writeMeta(result, before),
      };
    }

    const rows = hasNamed
      ? statement.all(named as Record<string, SqliteParam>, ...(positional as SqliteParam[]))
      : statement.all(...(positional as SqliteParam[]));

    const meta = returnedRowsMeta(before, readCounters(db));
    return meta === undefined ? rows : { rows, meta };
  };
}
