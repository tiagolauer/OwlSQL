import { CompiledQuery, type Kysely } from 'kysely';
import type { Executor } from '../index.js';

export function createKyselyExecutor<DB>(db: Kysely<DB>): Executor {
  return async (sql, params) => {
    const result = await db.executeQuery(CompiledQuery.raw(sql, params as unknown[]));
    return result.rows;
  };
}
