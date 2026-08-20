import { CompiledQuery, type Kysely } from 'kysely';
import type { Executor, QueryMeta } from '../index.js';

export function createKyselyExecutor<DB>(db: Kysely<DB>): Executor {
  return async (sql, params) => {
    const result = await db.executeQuery(CompiledQuery.raw(sql, params as unknown[]));
    const meta: QueryMeta = {};
    if (typeof result.numAffectedRows === 'bigint') {
      meta.rowCount = result.numAffectedRows;
    }
    if (typeof result.insertId === 'bigint') {
      meta.lastInsertRowid = result.insertId;
    }
    return { rows: [...result.rows], meta };
  };
}
