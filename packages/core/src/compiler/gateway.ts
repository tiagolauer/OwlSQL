import type { SchemaLike } from './schema/model.js';
import type {
  NextParams,
  NextQuery,
  NextRow,
  NextStrictQuery,
  NextStrictRow,
} from './next/index.js';

export type InferViaGateway<DB extends SchemaLike, Q extends string> =
  NextQuery<DB, Q>;

export type InferRowViaGateway<DB extends SchemaLike, Q extends string> =
  NextRow<DB, Q>;

export type InferStrictViaGateway<DB extends SchemaLike, Q extends string> =
  NextStrictQuery<DB, Q>;

export type InferStrictRowViaGateway<DB extends SchemaLike, Q extends string> =
  NextStrictRow<DB, Q>;

export type InferParamsViaGateway<DB extends SchemaLike, Q extends string> =
  NextParams<DB, Q>;
