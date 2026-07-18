import type postgres from 'postgres';
import type { Executor } from '../index.js';

type PostgresUnsafeParam = NonNullable<Parameters<postgres.Sql['unsafe']>[1]>[number];

export function createPostgresJsExecutor(client: postgres.Sql): Executor {
  return async (sql, params) => {
    return client.unsafe(sql, params as unknown as PostgresUnsafeParam[]);
  };
}
