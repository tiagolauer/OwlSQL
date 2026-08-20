import type { StatementKind } from '../../language/lexical/statement.js';
import type {
  DeleteQueryIR,
  InsertQueryIR,
  MergeQueryIR,
  SelectQueryIR,
  UpdateQueryIR,
} from '../../language/ir/query.js';
import type { ParseDeleteIR } from '../../language/dml/parse-delete.js';
import type { ParseInsertIR } from '../../language/dml/parse-insert.js';
import type { ParseMergeIR } from '../../language/dml/parse-merge.js';
import type { ParseUpdateIR } from '../../language/dml/parse-update.js';
import type { ParseSelectIR } from '../../language/select/parse-select.js';
import type { ParseWithIR, WithQueryIR } from '../../language/with/parse-with.js';
import type {
  ApplyLoosePolicy,
  ApplyStrictPolicy,
  CompileFatal,
  CompileOk,
} from '../contracts/compilation.js';
import type { Diagnostic } from '../contracts/diagnostic.js';
import type { QueryTypeError } from '../contracts/public-error.js';
import type { CompileSelect, CompileSelectIR } from './compile-select.js';
import type {
  CompileInsert,
  CompileInsertIR,
  InferInsertParams,
  InferInsertParamsFromIR,
} from './compile-insert.js';
import type {
  CompileUpdate,
  CompileUpdateIR,
  InferUpdateParams,
  InferUpdateParamsFromIR,
} from './compile-update.js';
import type {
  CompileDelete,
  CompileDeleteIR,
  InferDeleteParams,
  InferDeleteParamsFromIR,
} from './compile-delete.js';
import type {
  CompileMerge,
  CompileMergeIR,
  InferMergeParams,
  InferMergeParamsFromIR,
} from './compile-merge.js';
import type {
  CompileWith,
  CompileWithIR,
  InferWithParams,
  InferWithParamsFromIR,
} from './compile-with.js';
import type {
  InferNextParams,
  InferParamsFromIR,
  ParamValues,
} from './infer-params.js';

type UnsupportedStatement<Sql extends string> = Diagnostic<
  'UNSUPPORTED_STATEMENT',
  'unsupported or unrecognized statement',
  'error',
  'statement',
  Sql
>;

type ParsedStatement<Sql extends string> = StatementKind<Sql> extends infer Kind
  ? Kind extends 'select'
    ? { statement: 'select'; parsed: ParseSelectIR<Sql> }
    : Kind extends 'insert'
      ? { statement: 'insert'; parsed: ParseInsertIR<Sql> }
      : Kind extends 'update'
        ? { statement: 'update'; parsed: ParseUpdateIR<Sql> }
        : Kind extends 'delete'
          ? { statement: 'delete'; parsed: ParseDeleteIR<Sql> }
          : Kind extends 'merge'
            ? { statement: 'merge'; parsed: ParseMergeIR<Sql> }
            : Kind extends 'with'
              ? { statement: 'with'; parsed: ParseWithIR<Sql> }
              : { statement: 'unknown'; parsed: null }
  : never;

type FatalCompilation<Parsed> = Parsed extends {
  kind: 'fatal';
  diagnostics: infer Diagnostics extends readonly Diagnostic[];
}
  ? CompileFatal<unknown[], Diagnostics>
  : never;

type CompileParsed<
  DB,
  Parsed,
  ValidatePredicates extends boolean,
  Sql extends string,
> = Parsed extends { statement: 'select'; parsed: infer Result }
  ? Result extends { kind: 'ok'; value: infer IR extends SelectQueryIR }
    ? CompileSelectIR<DB, IR, null, ValidatePredicates>
    : FatalCompilation<Result>
  : Parsed extends { statement: 'insert'; parsed: infer Result }
    ? Result extends { kind: 'ok'; value: infer IR extends InsertQueryIR }
      ? CompileInsertIR<DB, IR, null, ValidatePredicates>
      : FatalCompilation<Result>
    : Parsed extends { statement: 'update'; parsed: infer Result }
      ? Result extends { kind: 'ok'; value: infer IR extends UpdateQueryIR }
        ? CompileUpdateIR<DB, IR, null, ValidatePredicates>
        : FatalCompilation<Result>
      : Parsed extends { statement: 'delete'; parsed: infer Result }
        ? Result extends { kind: 'ok'; value: infer IR extends DeleteQueryIR }
          ? CompileDeleteIR<DB, IR, null, ValidatePredicates>
          : FatalCompilation<Result>
        : Parsed extends { statement: 'merge'; parsed: infer Result }
          ? Result extends { kind: 'ok'; value: infer IR extends MergeQueryIR }
            ? CompileMergeIR<DB, IR, null, ValidatePredicates>
            : FatalCompilation<Result>
          : Parsed extends { statement: 'with'; parsed: infer Result }
            ? Result extends { kind: 'ok'; value: infer IR extends WithQueryIR }
              ? CompileWithIR<DB, IR, null, ValidatePredicates>
              : FatalCompilation<Result>
            : CompileOk<never[], [UnsupportedStatement<Sql>]>;

type FatalParams<Parsed, Fallback extends readonly unknown[] = unknown[]> =
  Parsed extends {
    kind: 'fatal';
    diagnostics: readonly [infer Error extends { message: string }, ...unknown[]];
  }
    ? [QueryTypeError<Error['message']>]
    : Fallback;

type ParamsFromParsed<DB, Parsed> =
  Parsed extends { statement: 'select'; parsed: infer Result }
    ? Result extends { kind: 'ok'; value: infer IR extends SelectQueryIR }
      ? ParamValues<InferParamsFromIR<DB, IR>>
      : FatalParams<Result>
    : Parsed extends { statement: 'insert'; parsed: infer Result }
      ? Result extends { kind: 'ok'; value: infer IR extends InsertQueryIR }
        ? InferInsertParamsFromIR<DB, IR>
        : unknown[]
      : Parsed extends { statement: 'update'; parsed: infer Result }
        ? Result extends { kind: 'ok'; value: infer IR extends UpdateQueryIR }
          ? InferUpdateParamsFromIR<DB, IR>
          : unknown[]
        : Parsed extends { statement: 'delete'; parsed: infer Result }
          ? Result extends { kind: 'ok'; value: infer IR extends DeleteQueryIR }
            ? InferDeleteParamsFromIR<DB, IR>
            : unknown[]
          : Parsed extends { statement: 'merge'; parsed: infer Result }
            ? Result extends { kind: 'ok'; value: infer IR extends MergeQueryIR }
              ? InferMergeParamsFromIR<DB, IR>
              : unknown[]
            : Parsed extends { statement: 'with'; parsed: infer Result }
              ? Result extends { kind: 'ok'; value: infer IR extends WithQueryIR }
                ? InferWithParamsFromIR<DB, IR>
                : FatalParams<Result>
              : unknown[];

export type CompileNext<
  DB,
  Sql extends string,
  ValidatePredicates extends boolean = true,
> = CompileParsed<DB, ParsedStatement<Sql>, ValidatePredicates, Sql>;

export type NextQuery<DB, Sql extends string> =
  ApplyLoosePolicy<CompileNext<DB, Sql, false>>;

export type NextStrictQuery<DB, Sql extends string> =
  ApplyStrictPolicy<CompileNext<DB, Sql>>;

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

export type NextParams<DB, Sql extends string> = ParamsFromParsed<DB, ParsedStatement<Sql>>;
