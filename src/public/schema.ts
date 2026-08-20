import type { Schema } from '../compiler/legacy.js';

export type {
  Schema,
  SchemaLike,
  QueryTypeError,
  FunctionReturnTypes,
} from '../compiler/legacy.js';

export function defineSchema<const DB extends Schema>(schema: DB): DB {
  return schema;
}
