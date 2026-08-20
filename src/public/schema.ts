import type { Schema } from '../compiler/legacy.js';

export type {
  Schema,
  SchemaLike,
  FunctionReturnTypes,
} from '../compiler/legacy.js';

export type { QueryTypeError } from '../compiler/contracts/public-error.js';

export function defineSchema<const DB extends Schema>(schema: DB): DB {
  return schema;
}
