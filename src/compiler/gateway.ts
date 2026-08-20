import type { StatementKind } from '../language/lexical/statement.js';
import type { ParseWithIR } from '../language/with/parse-with.js';
import type { ApplyLoosePolicy, ApplyStrictPolicy } from './contracts/compilation.js';
import type { SchemaLike } from './schema/model.js';
import type {
  LegacyInferParams,
  LegacyInferResult,
  LegacyInferResultStrict,
  LegacyInferRow,
  LegacyInferRowStrict,
} from './legacy.js';
import type { CompileSelect } from './next/compile-select.js';
import type { CompileWith, InferWithParams } from './next/compile-with.js';
import type { InferNextParams } from './next/infer-params.js';

type NextCompilation<
  DB,
  Q extends string,
  ValidatePredicates extends boolean,
> = Q extends `select ${string}`
  ? CompileSelect<DB, Q, null, ValidatePredicates>
  : GatewayKind<Q> extends 'select'
    ? CompileSelect<DB, Q, null, ValidatePredicates>
    : CompileWith<DB, Q, null, ValidatePredicates>;

type NextQuery<DB, Q extends string> =
  ApplyLoosePolicy<NextCompilation<DB, Q, false>>;

type NextStrictQuery<DB, Q extends string> =
  ApplyStrictPolicy<NextCompilation<DB, Q, true>>;

type NextRow<DB, Q extends string> = NextQuery<DB, Q> extends infer Result
  ? Result extends readonly (infer Row)[]
    ? Row
    : Result
  : never;

type NextStrictRow<DB, Q extends string> =
  NextStrictQuery<DB, Q> extends infer Result
    ? Result extends readonly (infer Row)[]
      ? Row
      : Result
    : never;

type GatewayKind<Q extends string> = Q extends `select ${string}`
  ? 'select'
  : StatementKind<Q>;

type UsesNext<Q extends string> = GatewayKind<Q> extends 'select'
  ? true
  : GatewayKind<Q> extends 'with'
    ? ParseWithIR<Q> extends { kind: 'ok' }
      ? true
      : false
    : false;

export type InferViaGateway<DB extends SchemaLike, Q extends string> =
  UsesNext<Q> extends true
    ? NextQuery<DB, Q>
    : LegacyInferResult<DB, Q>;

export type InferRowViaGateway<DB extends SchemaLike, Q extends string> =
  UsesNext<Q> extends true
    ? NextRow<DB, Q>
    : LegacyInferRow<DB, Q>;

export type InferStrictViaGateway<DB extends SchemaLike, Q extends string> =
  UsesNext<Q> extends true
    ? NextStrictQuery<DB, Q>
    : LegacyInferResultStrict<DB, Q>;

export type InferStrictRowViaGateway<DB extends SchemaLike, Q extends string> =
  UsesNext<Q> extends true
    ? NextStrictRow<DB, Q>
    : LegacyInferRowStrict<DB, Q>;

export type InferParamsViaGateway<DB extends SchemaLike, Q extends string> =
  GatewayKind<Q> extends 'select'
    ? InferNextParams<DB, Q>
    : GatewayKind<Q> extends 'with'
      ? UsesNext<Q> extends true
        ? InferWithParams<DB, Q>
        : LegacyInferParams<DB, Q>
      : LegacyInferParams<DB, Q>;
