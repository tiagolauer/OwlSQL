import type postgres from 'postgres';
import type { DialectExecutor } from '../index.js';

type PostgresUnsafeParam = NonNullable<Parameters<postgres.Sql['unsafe']>[1]>[number];

export function createPostgresJsExecutor(client: postgres.Sql): DialectExecutor<'dollar'> {
  return async (sql, params) => {
    const result = await client.unsafe(sql, params as unknown as PostgresUnsafeParam[]);
    return {
      rows: [...result],
      meta: typeof result.count === 'number' ? { rowCount: result.count } : {},
    };
  };
}
