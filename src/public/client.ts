import type {
  LegacyInferParams,
  LegacyInferResult,
  LegacyInferResultStrict,
  QueryTypeError,
  UsedPlaceholderStyles,
} from '../compiler/legacy.js';
import type { SchemaLike } from '../compiler/schema/model.js';
import { createRuntimeDb } from '../runtime/db.js';
import type {
  DialectExecutor,
  Executor,
  ExecutorResult,
  PlaceholderStyle,
} from '../runtime/executor.js';
import type { QueryError } from '../runtime/errors.js';
import type { Result } from '../runtime/result.js';

export type {
  Executor,
  ExecutorResult,
  DialectExecutor,
  PlaceholderStyle,
  QueryError,
};

export { QueryErrorKind } from '../runtime/errors.js';

type ValidatePlaceholderStyle<
  Q extends string,
  Style extends PlaceholderStyle,
> = PlaceholderStyle extends Style
  ? unknown
  : [UsedPlaceholderStyles<Q>] extends [never]
    ? unknown
    : [UsedPlaceholderStyles<Q>] extends [Style]
      ? unknown
      : QueryTypeError<'the query placeholder style does not match the executor dialect'>;

export interface TypedDbOptions {
  strict?: boolean;
  placeholders?: PlaceholderStyle;
}

type OptionsStyle<Options> =
  Options extends { placeholders: infer Style extends PlaceholderStyle }
    ? Style
    : PlaceholderStyle;

export interface TypedDb<
  DB extends SchemaLike,
  Strict extends boolean = false,
  Style extends PlaceholderStyle = PlaceholderStyle,
> {
  readonly __owlsqlTypedDb?: true;
  query<Q extends string>(
    sql: Q & ValidatePlaceholderStyle<Q, Style>,
    ...params: LegacyInferParams<DB, Q>
  ): Promise<
    Result<
      Strict extends true
        ? LegacyInferResultStrict<DB, Q>
        : LegacyInferResult<DB, Q>,
      QueryError
    >
  >;
}

export function createTypedDb<DB extends SchemaLike>(
  executor: Executor,
): TypedDb<DB, false, PlaceholderStyle>;

export function createTypedDb<
  DB extends SchemaLike,
  const Options extends TypedDbOptions,
>(
  executor: Executor,
  options?: Options,
): TypedDb<
  DB,
  Options extends { strict: true } ? true : false,
  OptionsStyle<Options>
>;

export function createTypedDb<
  DB extends SchemaLike,
  const Options extends TypedDbOptions = TypedDbOptions,
>(
  executor: Executor,
  options?: Options,
): TypedDb<
  DB,
  Options extends { strict: true } ? true : false,
  OptionsStyle<Options>
> {
  void options;
  const runtime = createRuntimeDb(executor);

  return {
    async query(sql, ...params) {
      return await runtime.query(sql, params) as never;
    },
  };
}
