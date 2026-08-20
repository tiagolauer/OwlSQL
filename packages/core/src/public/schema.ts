import type { Schema } from '../compiler/schema/model.js';

export type {
  Schema,
  SchemaLike,
} from '../compiler/schema/model.js';

export type { QueryTypeError } from '../compiler/contracts/public-error.js';

export function defineSchema<const DB extends Schema>(schema: DB): DB {
  return schema;
}
