import type { Pool } from 'pg';
import type { Executor } from '../index.js';

export function createPgExecutor(pool: Pool): Executor {
  return async (sql, params) => {
    const result = await pool.query(sql, params as unknown[]);
    return result.rows;
  };
}
