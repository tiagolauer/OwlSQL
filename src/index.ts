import type { Schema, SchemaLike, InferResult, InferRow } from './parse.js';
import { type Result, ok, err } from './result.js';

export type { Schema, SchemaLike, InferResult, InferRow } from './parse.js';
export type { ParseSelect, ParsedSelect } from './parse.js';
export type { Result, Ok, Err } from './result.js';
export { ResultStatus, ok, err, isOk, isErr } from './result.js';

export type Query<DB extends SchemaLike, Q extends string> = InferResult<DB, Q>;

export type Row<DB extends SchemaLike, Q extends string> = InferRow<DB, Q>;

export enum QueryErrorKind {
  EmptyQuery = 'EMPTY_QUERY',
  ExecutorFailed = 'EXECUTOR_FAILED',
}

export interface QueryError {
  kind: QueryErrorKind;
  message: string;
  cause?: unknown;
}

export type Executor = (sql: string, params: readonly unknown[]) => Promise<unknown[]>;

export interface TypedDb<DB extends SchemaLike> {
  query<Q extends string>(
    sql: Q,
    ...params: readonly unknown[]
  ): Promise<Result<InferResult<DB, Q>, QueryError>>;
}

export function createTypedDb<DB extends SchemaLike>(
  executor: Executor,
): TypedDb<DB> {
  return {
    async query(sql, ...params) {
      if (!sql.trim()) {
        return err({
          kind: QueryErrorKind.EmptyQuery,
          message: 'SQL query string is empty.',
        });
      }

      try {
        const rows = await executor(sql, params);
        return ok(rows as InferResult<DB, typeof sql>);
      } catch (cause) {
        return err({
          kind: QueryErrorKind.ExecutorFailed,
          message: 'The executor threw while running the query.',
          cause,
        });
      }
    },
  };
}

export function defineSchema<const DB extends Schema>(schema: DB): DB {
  return schema;
}
