export type {
  Query,
  Row,
  StrictQuery,
  StrictRow,
  Params,
  InferResult,
  InferRow,
  InferResultStrict,
  InferRowStrict,
  InferParams,
} from './public/query.js';

export type {
  Schema,
  SchemaLike,
  QueryTypeError,
  FunctionReturnTypes,
} from './public/schema.js';

export type {
  Executor,
  ExecutorResult,
  DialectExecutor,
  PlaceholderStyle,
  QueryError,
  TypedDb,
  TypedDbOptions,
} from './public/client.js';

export {
  QueryErrorKind,
  createTypedDb,
} from './public/client.js';

export type {
  Result,
  Ok,
  Err,
  QueryMeta,
} from './public/result.js';

export {
  ResultStatus,
  ok,
  err,
  isOk,
  isErr,
} from './public/result.js';

export type {
  ParseSelect,
  ParseStatement,
  ParsedStatement,
  Source,
} from './compiler/legacy.js';

export { defineSchema } from './public/schema.js';
