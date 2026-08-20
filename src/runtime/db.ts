import type { Executor } from './executor.js';
import { QueryErrorKind, describeCause, type QueryError } from './errors.js';
import { err, ok, type Result } from './result.js';

export interface RuntimeDb {
  query(
    sql: string,
    params: readonly unknown[],
  ): Promise<Result<unknown[], QueryError>>;
}

export function createRuntimeDb(executor: Executor): RuntimeDb {
  return {
    async query(sql, params) {
      if (!sql.trim()) {
        return err({
          kind: QueryErrorKind.EmptyQuery,
          message: 'SQL query string is empty.',
        });
      }

      try {
        const executed = await executor(sql, params);
        const rows = Array.isArray(executed) ? executed : executed.rows;
        const meta = Array.isArray(executed) ? undefined : executed.meta;
        return ok(rows, meta);
      } catch (cause) {
        return err({
          kind: QueryErrorKind.ExecutorFailed,
          message: `The executor threw while running the query: ${describeCause(cause)}`,
          cause,
        });
      }
    },
  };
}
