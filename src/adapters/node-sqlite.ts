import type { DatabaseSync } from 'node:sqlite';
import type { Executor } from '../index.js';

type SqliteParam = null | number | bigint | string | NodeJS.ArrayBufferView;

export function createNodeSqliteExecutor(db: DatabaseSync): Executor {
  return async (sql, params) => {
    return db.prepare(sql).all(...(params as unknown as SqliteParam[]));
  };
}
