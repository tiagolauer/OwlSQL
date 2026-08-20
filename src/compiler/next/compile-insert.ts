import type {
  InsertQueryIR,
  InsertSelectIR,
  InsertValuesIR,
} from '../../language/ir/query.js';
import type { TableSourceIR } from '../../language/ir/source.js';
import type { WriteTargetIR } from '../../language/ir/write.js';
import type { ParseInsertIR } from '../../language/dml/parse-insert.js';
import type { CompileFatal, CompileOk } from '../contracts/compilation.js';
import type { Diagnostic } from '../contracts/diagnostic.js';
import type { CompileSelectIR } from './compile-select.js';
import type { InferOutput } from './infer-output.js';
import type {
  AnyParamState,
  EmptyParamState,
  ParamValues,
  ScanParamFragment,
  ScanTypedFragment,
} from './infer-params.js';
import type {
  ResolveWriteColumn,
  ResolveWriteTarget,
} from './resolve-write-target.js';
import type { Scope } from './scope.js';

type TargetSource<Target extends WriteTargetIR> = TableSourceIR<
  Target['name'],
  Target['alias'],
  false,
  'root',
  []
>;

type TargetDiagnostics<
  DB,
  Target extends WriteTargetIR,
  Validate extends boolean,
> = Validate extends true
  ? ResolveWriteTarget<DB, Target> extends {
      kind: 'error';
      diagnostic: infer Error extends Diagnostic;
    }
    ? [Error]
    : []
  : [];

type ColumnDiagnostics<
  DB,
  Target extends WriteTargetIR,
  Columns extends readonly string[],
  Validate extends boolean,
  Diagnostics extends readonly Diagnostic[] = [],
> = Validate extends false
  ? Diagnostics
  : Columns extends readonly [
        infer Head extends string,
        ...infer Tail extends string[],
      ]
    ? ResolveWriteColumn<DB, Target, Head> extends {
        kind: 'error';
        diagnostic: infer Error extends Diagnostic;
      }
      ? ColumnDiagnostics<DB, Target, Tail, Validate, [...Diagnostics, Error]>
      : ColumnDiagnostics<DB, Target, Tail, Validate, Diagnostics>
    : Diagnostics;

type SourceDiagnostics<
  DB,
  Source,
  ParentScope,
  Validate extends boolean,
> = Source extends InsertSelectIR<infer Query>
  ? CompileSelectIR<DB, Query, ParentScope, Validate> extends infer Compiled
    ? Compiled extends CompileOk<readonly unknown[], infer Diagnostics>
      ? Diagnostics
      : Compiled extends CompileFatal<unknown[], infer Diagnostics>
        ? Diagnostics
        : []
    : []
  : [];

export type CompileInsertIR<
  DB,
  IR extends InsertQueryIR,
  ParentScope = null,
  Validate extends boolean = true,
> = InferOutput<
  DB,
  Scope<[TargetSource<IR['target']>], ParentScope>,
  IR['output']
> extends CompileOk<infer Rows, infer OutputDiagnostics>
  ? CompileOk<
      Rows,
      [
        ...TargetDiagnostics<DB, IR['target'], Validate>,
        ...ColumnDiagnostics<DB, IR['target'], IR['columns'], Validate>,
        ...SourceDiagnostics<DB, IR['source'], ParentScope, Validate>,
        ...OutputDiagnostics,
      ]
    >
  : never;

export type CompileInsert<
  DB,
  Sql extends string,
  ParentScope = null,
  Validate extends boolean = true,
> = ParseInsertIR<Sql> extends infer Parsed
  ? Parsed extends { kind: 'ok'; value: infer IR extends InsertQueryIR }
    ? CompileInsertIR<DB, IR, ParentScope, Validate>
    : Parsed extends CompileFatal<InsertQueryIR, infer Diagnostics>
      ? CompileFatal<unknown[], Diagnostics>
      : never
  : never;

type ColumnValue<
  DB,
  Target extends WriteTargetIR,
  Column extends string,
> = ResolveWriteColumn<DB, Target, Column> extends {
  kind: 'ok';
  value: infer Value;
}
  ? Value
  : unknown;

export type ScanWriteValues<
  DB,
  Target extends WriteTargetIR,
  Columns extends readonly string[],
  Values extends readonly string[],
  State extends AnyParamState,
> = Columns extends readonly [
  infer Column extends string,
  ...infer ColumnTail extends string[],
]
  ? Values extends readonly [
      infer Value extends string,
      ...infer ValueTail extends string[],
    ]
    ? ScanTypedFragment<
        Value,
        ColumnValue<DB, Target, Column>,
        State
      > extends infer Next extends AnyParamState
      ? ScanWriteValues<DB, Target, ColumnTail, ValueTail, Next>
      : never
    : State
  : State;

type ScanRows<
  DB,
  Target extends WriteTargetIR,
  Columns extends readonly string[],
  Rows extends readonly (readonly string[])[],
  State extends AnyParamState = EmptyParamState,
> = Rows extends readonly [
  infer Head extends readonly string[],
  ...infer Tail extends readonly (readonly string[])[],
]
  ? ScanWriteValues<DB, Target, Columns, Head, State> extends infer Next extends AnyParamState
    ? ScanRows<DB, Target, Columns, Tail, Next>
    : never
  : State;

export type InferInsertParamsFromIR<
  DB,
  IR extends InsertQueryIR,
> = IR['columns'] extends readonly []
  ? unknown[]
  : IR['source'] extends InsertValuesIR<infer Rows, infer Tail>
    ? ScanRows<DB, IR['target'], IR['columns'], Rows> extends infer ValuesState extends AnyParamState
      ? ScanParamFragment<
          DB,
          Scope<[TargetSource<IR['target']>]>,
          Tail,
          ValuesState
        > extends infer FinalState extends AnyParamState
        ? ParamValues<FinalState>
        : unknown[]
      : unknown[]
    : IR['source'] extends InsertSelectIR
      ? unknown[]
      : [];

export type InferInsertParams<DB, Sql extends string> =
  ParseInsertIR<Sql> extends {
    kind: 'ok';
    value: infer IR extends InsertQueryIR;
  }
    ? InferInsertParamsFromIR<DB, IR>
    : unknown[];
