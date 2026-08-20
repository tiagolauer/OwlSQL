import type { StatementKind } from '../language/lexical/statement.js';
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
import type { InferNextParams } from './next/infer-params.js';

type NextQuery<DB, Q extends string> =
  ApplyLoosePolicy<CompileSelect<DB, Q, null, false>>;

type NextStrictQuery<DB, Q extends string> =
  ApplyStrictPolicy<CompileSelect<DB, Q>>;

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

export type InferViaGateway<DB extends SchemaLike, Q extends string> =
  GatewayKind<Q> extends 'select'
    ? NextQuery<DB, Q>
    : LegacyInferResult<DB, Q>;

export type InferRowViaGateway<DB extends SchemaLike, Q extends string> =
  GatewayKind<Q> extends 'select'
    ? NextRow<DB, Q>
    : LegacyInferRow<DB, Q>;

export type InferStrictViaGateway<DB extends SchemaLike, Q extends string> =
  GatewayKind<Q> extends 'select'
    ? NextStrictQuery<DB, Q>
    : LegacyInferResultStrict<DB, Q>;

export type InferStrictRowViaGateway<DB extends SchemaLike, Q extends string> =
  GatewayKind<Q> extends 'select'
    ? NextStrictRow<DB, Q>
    : LegacyInferRowStrict<DB, Q>;

export type InferParamsViaGateway<DB extends SchemaLike, Q extends string> =
  GatewayKind<Q> extends 'select'
    ? InferNextParams<DB, Q>
    : LegacyInferParams<DB, Q>;
