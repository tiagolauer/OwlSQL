import type { Pool, Client, PoolClient } from 'pg';
import type { DialectExecutor } from '../index.js';

export type PgQueryable = Pool | Client | PoolClient;

export function createPgExecutor(client: PgQueryable): DialectExecutor<'dollar'> {
  return async (sql, params) => {
    const result =
      params.length === 0 ? await client.query(sql) : await client.query(sql, params as unknown[]);

    return {
      rows: result.rows,
      meta: result.rowCount === null ? {} : { rowCount: result.rowCount },
    };
  };
}
