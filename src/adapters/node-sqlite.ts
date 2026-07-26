import type { DatabaseSync } from 'node:sqlite';
import type { DialectExecutor } from '../index.js';
import { resolveMixedParameters } from './named-params.js';

type SqliteParam = null | number | bigint | string | NodeJS.ArrayBufferView;

const SQLITE_PARAM_PREFIXES: ReadonlySet<string> = new Set(['@', '$', ':']);

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

function hasResultColumns(statement: import('node:sqlite').StatementSync): boolean {
  try {
    return statement.columns().length > 0;
  } catch {
    return true;
  }
}

export function createNodeSqliteExecutor(
  db: DatabaseSync,
): DialectExecutor<'question' | 'at' | 'dollar'> {
  return async (sql, params) => {
    const statement = db.prepare(sql);
    const values = params.map(toSqliteValue);
    const { named, positional } = resolveMixedParameters(sql, SQLITE_PARAM_PREFIXES, values);

    if (!hasResultColumns(statement)) {
      const result = Object.keys(named).length > 0
        ? statement.run(named as Record<string, SqliteParam>, ...(positional as SqliteParam[]))
        : statement.run(...(positional as SqliteParam[]));
      return {
        rows: [],
        meta: {
          rowCount: result.changes,
          lastInsertRowid: result.lastInsertRowid,
        },
      };
    }

    if (Object.keys(named).length > 0) {
      return statement.all(named as Record<string, SqliteParam>, ...(positional as SqliteParam[]));
    }

    return statement.all(...(positional as SqliteParam[]));
  };
}
