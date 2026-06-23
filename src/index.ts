import type {
  Schema,
  SchemaLike,
  InferResult,
  InferRow,
  InferResultStrict,
  InferRowStrict,
} from './parse.js';
import { type Result, ok, err } from './result.js';

export type {
  Schema,
  SchemaLike,
  InferResult,
  InferRow,
  InferResultStrict,
  InferRowStrict,
  QueryTypeError,
} from './parse.js';
export type { ParseSelect, ParseStatement, ParsedSelect } from './parse.js';
export type { FunctionReturnTypes } from './functions.js';
export type { Result, Ok, Err } from './result.js';
export { ResultStatus, ok, err, isOk, isErr } from './result.js';

export type Query<DB extends SchemaLike, Q extends string> = InferResult<DB, Q>;

export type Row<DB extends SchemaLike, Q extends string> = InferRow<DB, Q>;

export type StrictQuery<DB extends SchemaLike, Q extends string> = InferResultStrict<DB, Q>;

export type StrictRow<DB extends SchemaLike, Q extends string> = InferRowStrict<DB, Q>;

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

export interface TypedDbOptions {
  strict?: boolean;
}

export interface TypedDb<DB extends SchemaLike, Strict extends boolean = false> {
  query<Q extends string>(
    sql: Q,
    ...params: readonly unknown[]
  ): Promise<
    Result<Strict extends true ? InferResultStrict<DB, Q> : InferResult<DB, Q>, QueryError>
  >;
}

export function createTypedDb<
  DB extends SchemaLike,
  const Options extends TypedDbOptions = TypedDbOptions,
>(
  executor: Executor,
  options?: Options,
): TypedDb<DB, Options extends { strict: true } ? true : false> {
  void options;
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
        return ok(rows as never);
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
