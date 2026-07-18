import type { Pool } from 'mysql2/promise';
import type { Executor } from '../index.js';

export function createMysql2Executor(pool: Pool): Executor {
  return async (sql, params) => {
    const [rows] = await pool.query(sql, params as unknown[]);
    return rows as unknown[];
  };
}
