import type { StatementKind } from '../../language/lexical/statement.js';
import type {
  ApplyLoosePolicy,
  ApplyStrictPolicy,
  CompileFatal,
} from '../contracts/compilation.js';
import type { Diagnostic } from '../contracts/diagnostic.js';
import type { CompileSelect } from './compile-select.js';

type UnsupportedStatement<Sql extends string> = Diagnostic<
  'UNSUPPORTED_STATEMENT',
  'unsupported statement',
  'fatal',
  'statement',
  Sql
>;

export type CompileNext<DB, Sql extends string> =
  StatementKind<Sql> extends 'select'
    ? CompileSelect<DB, Sql>
    : CompileFatal<unknown[], [UnsupportedStatement<Sql>]>;

export type NextQuery<DB, Sql extends string> =
  ApplyLoosePolicy<CompileNext<DB, Sql>>;

export type NextStrictQuery<DB, Sql extends string> =
  ApplyStrictPolicy<CompileNext<DB, Sql>>;
