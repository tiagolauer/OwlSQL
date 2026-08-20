import type {
  LegacyInferParams,
  LegacyInferResult,
  LegacyInferResultStrict,
  LegacyInferRow,
  LegacyInferRowStrict,
} from '../compiler/legacy.js';
import type { SchemaLike } from '../compiler/schema/model.js';

export type {
  LegacyInferParams as InferParams,
  LegacyInferResult as InferResult,
  LegacyInferResultStrict as InferResultStrict,
  LegacyInferRow as InferRow,
  LegacyInferRowStrict as InferRowStrict,
} from '../compiler/legacy.js';

export type Query<DB extends SchemaLike, Q extends string> = LegacyInferResult<DB, Q>;

export type Row<DB extends SchemaLike, Q extends string> = LegacyInferRow<DB, Q>;

export type StrictQuery<DB extends SchemaLike, Q extends string> =
  LegacyInferResultStrict<DB, Q>;

export type StrictRow<DB extends SchemaLike, Q extends string> = LegacyInferRowStrict<DB, Q>;

export type Params<DB extends SchemaLike, Q extends string> = LegacyInferParams<DB, Q>;
