import type {
  InferParamsViaGateway,
  InferRowViaGateway,
  InferStrictRowViaGateway,
  InferStrictViaGateway,
  InferViaGateway,
} from '../compiler/gateway.js';
import type { SchemaLike } from '../schema/model.js';

export type {
  InferParamsViaGateway as InferParams,
  InferRowViaGateway as InferRow,
  InferStrictRowViaGateway as InferRowStrict,
  InferStrictViaGateway as InferResultStrict,
  InferViaGateway as InferResult,
} from '../compiler/gateway.js';

export type Query<DB extends SchemaLike, Q extends string> = InferViaGateway<DB, Q>;

export type Row<DB extends SchemaLike, Q extends string> = InferRowViaGateway<DB, Q>;

export type StrictQuery<DB extends SchemaLike, Q extends string> =
  InferStrictViaGateway<DB, Q>;

export type StrictRow<DB extends SchemaLike, Q extends string> = InferStrictRowViaGateway<DB, Q>;

export type Params<DB extends SchemaLike, Q extends string> = InferParamsViaGateway<DB, Q>;
