import type { StatementKind } from '../../language/lexical/statement.js';
import type {
  ApplyLoosePolicy,
  ApplyStrictPolicy,
  CompileFatal,
} from '../contracts/compilation.js';
import type { Diagnostic } from '../contracts/diagnostic.js';
import type { CompileSelect } from './compile-select.js';
import type { CompileInsert, InferInsertParams } from './compile-insert.js';
import type { CompileUpdate, InferUpdateParams } from './compile-update.js';
import type { CompileDelete, InferDeleteParams } from './compile-delete.js';
import type { CompileMerge, InferMergeParams } from './compile-merge.js';
import type { CompileWith, InferWithParams } from './compile-with.js';
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
> = Sql extends `select ${string}`
  ? CompileSelect<DB, Sql>
  : StatementKind<Sql> extends 'select'
    ? CompileSelect<DB, Sql>
    : StatementKind<Sql> extends 'insert'
      ? CompileInsert<DB, Sql>
    : StatementKind<Sql> extends 'update'
      ? CompileUpdate<DB, Sql>
    : StatementKind<Sql> extends 'delete'
      ? CompileDelete<DB, Sql>
    : StatementKind<Sql> extends 'merge'
      ? CompileMerge<DB, Sql>
    : StatementKind<Sql> extends 'with'
      ? CompileWith<DB, Sql>
      : CompileFatal<unknown[], [UnsupportedStatement<Sql>]>;

export type NextQuery<DB, Sql extends string> =
  ApplyLoosePolicy<CompileSelect<DB, Sql, null, false>>;

export type NextStrictQuery<DB, Sql extends string> =
  ApplyStrictPolicy<CompileSelect<DB, Sql>>;

export type NextWithQuery<DB, Sql extends string> =
  ApplyLoosePolicy<CompileWith<DB, Sql, null, false>>;

export type NextWithStrictQuery<DB, Sql extends string> =
  ApplyStrictPolicy<CompileWith<DB, Sql>>;

export type NextInsertQuery<DB, Sql extends string> =
  ApplyLoosePolicy<CompileInsert<DB, Sql, null, false>>;

export type NextInsertStrictQuery<DB, Sql extends string> =
  ApplyStrictPolicy<CompileInsert<DB, Sql>>;

export type NextInsertRow<DB, Sql extends string> =
  NextInsertQuery<DB, Sql> extends infer Result
    ? Result extends readonly (infer Row)[]
      ? Row
      : Result
    : never;

export type NextInsertStrictRow<DB, Sql extends string> =
  NextInsertStrictQuery<DB, Sql> extends infer Result
    ? Result extends readonly (infer Row)[]
      ? Row
      : Result
    : never;

export type NextInsertInferParams<DB, Sql extends string> =
  InferInsertParams<DB, Sql>;

export type NextUpdateQuery<DB, Sql extends string> =
  ApplyLoosePolicy<CompileUpdate<DB, Sql, null, false>>;

export type NextUpdateStrictQuery<DB, Sql extends string> =
  ApplyStrictPolicy<CompileUpdate<DB, Sql>>;

export type NextUpdateRow<DB, Sql extends string> =
  NextUpdateQuery<DB, Sql> extends infer Result
    ? Result extends readonly (infer Row)[]
      ? Row
      : Result
    : never;

export type NextUpdateStrictRow<DB, Sql extends string> =
  NextUpdateStrictQuery<DB, Sql> extends infer Result
    ? Result extends readonly (infer Row)[]
      ? Row
      : Result
    : never;

export type NextUpdateInferParams<DB, Sql extends string> =
  InferUpdateParams<DB, Sql>;

export type NextDeleteQuery<DB, Sql extends string> =
  ApplyLoosePolicy<CompileDelete<DB, Sql, null, false>>;

export type NextDeleteStrictQuery<DB, Sql extends string> =
  ApplyStrictPolicy<CompileDelete<DB, Sql>>;

export type NextDeleteRow<DB, Sql extends string> =
  NextDeleteQuery<DB, Sql> extends infer Result
    ? Result extends readonly (infer Row)[]
      ? Row
      : Result
    : never;

export type NextDeleteStrictRow<DB, Sql extends string> =
  NextDeleteStrictQuery<DB, Sql> extends infer Result
    ? Result extends readonly (infer Row)[]
      ? Row
      : Result
    : never;

export type NextDeleteInferParams<DB, Sql extends string> =
  InferDeleteParams<DB, Sql>;

export type NextMergeQuery<DB, Sql extends string> =
  ApplyLoosePolicy<CompileMerge<DB, Sql, null, false>>;

export type NextMergeStrictQuery<DB, Sql extends string> =
  ApplyStrictPolicy<CompileMerge<DB, Sql>>;

export type NextMergeRow<DB, Sql extends string> =
  NextMergeQuery<DB, Sql> extends infer Result
    ? Result extends readonly (infer Row)[]
      ? Row
      : Result
    : never;

export type NextMergeStrictRow<DB, Sql extends string> =
  NextMergeStrictQuery<DB, Sql> extends infer Result
    ? Result extends readonly (infer Row)[]
      ? Row
      : Result
    : never;

export type NextMergeInferParams<DB, Sql extends string> =
  InferMergeParams<DB, Sql>;

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

export type NextWithInferParams<DB, Sql extends string> = InferWithParams<DB, Sql>;
