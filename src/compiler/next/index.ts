import type { StatementKind } from '../../language/lexical/statement.js';
import type {
  ApplyLoosePolicy,
  ApplyStrictPolicy,
  CompileFatal,
} from '../contracts/compilation.js';
import type { Diagnostic } from '../contracts/diagnostic.js';
import type { CompileSelect } from './compile-select.js';
import type { InferNextParams } from './infer-params.js';

type UnsupportedStatement<Sql extends string> = Diagnostic<
  'UNSUPPORTED_STATEMENT',
  'unsupported statement',
  'fatal',
  'statement',
  Sql
>;

export type CompileNext<
  DB,
  Sql extends string,
> = StatementKind<Sql> extends 'select'
    ? CompileSelect<DB, Sql>
    : CompileFatal<unknown[], [UnsupportedStatement<Sql>]>;

export type NextQuery<DB, Sql extends string> =
  ApplyLoosePolicy<CompileSelect<DB, Sql, null, false>>;

export type NextStrictQuery<DB, Sql extends string> =
  ApplyStrictPolicy<CompileSelect<DB, Sql>>;

export type NextRow<DB, Sql extends string> =
  NextQuery<DB, Sql> extends infer Result
  ? Result extends readonly (infer Row)[]
    ? Row
    : Result
  : never;

export type NextStrictRow<DB, Sql extends string> =
  NextStrictQuery<DB, Sql> extends infer Result
  ? Result extends readonly (infer Row)[]
    ? Row
    : Result
  : never;

export type NextInferParams<DB, Sql extends string> = InferNextParams<DB, Sql>;
