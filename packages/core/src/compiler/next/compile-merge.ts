import type { ParseMergeIR } from '../../language/dml/parse-merge.js';
import type { MergeQueryIR } from '../../language/ir/query.js';
import type {
  DerivedSourceIR,
  SourceIR,
  TableSourceIR,
} from '../../language/ir/source.js';
import type {
  AssignmentIR,
  MergeActionIR,
  WriteTargetIR,
} from '../../language/ir/write.js';
import type { CompileFatal, CompileOk } from '../contracts/compilation.js';
import type { Diagnostic } from '../contracts/diagnostic.js';
import type { ResolveKey } from '../../schema/model.js';
import type { AnalyzePredicates } from './compile-select.js';
import type { ScanWriteValues } from './compile-insert.js';
import type { InferOutput } from './infer-output.js';
import type {
  AnyParamState,
  EmptyParamState,
  ParamValues,
  ScanPredicateParams,
  ScanTypedFragment,
} from './infer-params.js';
import type { ResolveWriteTarget } from './resolve-write-target.js';
import type { Scope } from './scope.js';

type MergeActionValue = 'INSERT' | 'UPDATE' | 'DELETE';

type TargetSource<IR extends MergeQueryIR> = TableSourceIR<
  IR['target']['name'],
  IR['target']['alias'],
  false,
  'root',
  []
>;

type UnknownTable<Name extends string> = Diagnostic<
  'UNKNOWN_TABLE',
  `unknown table: ${Name}`,
  'error',
  'from',
  Name
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

type SourceDiagnostics<
  DB,
  Sources extends readonly SourceIR[],
  Validate extends boolean,
  Diagnostics extends readonly Diagnostic[] = [],
> = Validate extends false
  ? Diagnostics
  : Sources extends readonly [
        infer Head extends SourceIR,
        ...infer Tail extends SourceIR[],
      ]
    ? Head extends TableSourceIR<infer Name, string, boolean, import('../../language/ir/source.js').JoinKind, readonly string[]>
      ? ResolveKey<DB, Name> extends never
        ? SourceDiagnostics<DB, Tail, Validate, [...Diagnostics, UnknownTable<Name>]>
        : SourceDiagnostics<DB, Tail, Validate, Diagnostics>
      : SourceDiagnostics<DB, Tail, Validate, Diagnostics>
    : Diagnostics;

type AssignmentValues<
  Assignments extends readonly AssignmentIR[],
  Result extends string[] = [],
> = Assignments extends readonly [
  infer Head extends AssignmentIR,
  ...infer Tail extends AssignmentIR[],
]
  ? AssignmentValues<Tail, [...Result, Head['value']]>
  : Result;

type AssignmentColumns<
  Assignments extends readonly AssignmentIR[],
  Result extends string[] = [],
> = Assignments extends readonly [
  infer Head extends AssignmentIR,
  ...infer Tail extends AssignmentIR[],
]
  ? AssignmentColumns<Tail, [...Result, Head['target']]>
  : Result;

type MergeScope<IR extends MergeQueryIR, ParentScope = null> = Scope<
  [TargetSource<IR>, ...IR['sources']],
  ParentScope
>;

type MergeOutputScope<IR extends MergeQueryIR, ParentScope = null> = Scope<
  [
    TargetSource<IR>,
    DerivedSourceIR<'$merge', { $action: MergeActionValue }>,
  ],
  ParentScope
>;

export type CompileMergeIR<
  DB,
  IR extends MergeQueryIR,
  ParentScope = null,
  Validate extends boolean = true,
> = InferOutput<DB, MergeOutputScope<IR, ParentScope>, IR['output']> extends CompileOk<
  infer Rows,
  infer OutputDiagnostics
>
  ? CompileOk<
      Rows,
      [
        ...TargetDiagnostics<DB, IR['target'], Validate>,
        ...SourceDiagnostics<DB, IR['sources'], Validate>,
        ...(Validate extends true
          ? AnalyzePredicates<DB, MergeScope<IR, ParentScope>, IR['predicates']>
          : []),
        ...OutputDiagnostics,
      ]
    >
  : never;

export type CompileMerge<
  DB,
  Sql extends string,
  ParentScope = null,
  Validate extends boolean = true,
> = ParseMergeIR<Sql> extends infer Parsed
  ? Parsed extends { kind: 'ok'; value: infer IR extends MergeQueryIR }
    ? CompileMergeIR<DB, IR, ParentScope, Validate>
    : Parsed extends CompileFatal<MergeQueryIR, infer Diagnostics>
      ? CompileFatal<unknown[], Diagnostics>
      : never
  : never;

type ScanFragments<
  Fragments extends readonly string[],
  State extends AnyParamState,
> = Fragments extends readonly [
  infer Head extends string,
  ...infer Tail extends string[],
]
  ? ScanTypedFragment<Head, unknown, State> extends infer Next extends AnyParamState
    ? ScanFragments<Tail, Next>
    : never
  : State;

type ScanActions<
  DB,
  IR extends MergeQueryIR,
  Actions extends readonly MergeActionIR[],
  State extends AnyParamState,
> = Actions extends readonly [
  infer Head extends MergeActionIR,
  ...infer Tail extends MergeActionIR[],
]
  ? Head extends { kind: 'update'; assignments: infer Assignments extends readonly AssignmentIR[] }
    ? ScanWriteValues<
        DB,
        IR['target'],
        AssignmentColumns<Assignments>,
        AssignmentValues<Assignments>,
        State
      > extends infer Next extends AnyParamState
      ? ScanActions<DB, IR, Tail, Next>
      : never
    : Head extends {
          kind: 'insert';
          columns: infer Columns extends readonly string[];
          values: infer Values extends readonly string[];
        }
      ? ScanFragments<
          Values,
          State
        > extends infer Next extends AnyParamState
        ? ScanActions<DB, IR, Tail, Next>
        : never
      : ScanActions<DB, IR, Tail, State>
  : State;

export type InferMergeParamStateFromIR<
  DB,
  IR extends MergeQueryIR,
  State extends AnyParamState = EmptyParamState,
  ParentScope = null,
> = ScanFragments<IR['sourceValues'], State> extends infer SourceState extends AnyParamState
    ? ScanPredicateParams<
        DB,
        MergeScope<IR, ParentScope>,
        IR['predicates'],
        SourceState
      > extends infer PredicateState extends AnyParamState
      ? ScanActions<DB, IR, IR['actions'], PredicateState>
      : State
    : State;

export type InferMergeParamsFromIR<DB, IR extends MergeQueryIR> =
  ParamValues<InferMergeParamStateFromIR<DB, IR>>;

export type InferMergeParams<DB, Sql extends string> =
  ParseMergeIR<Sql> extends {
    kind: 'ok';
    value: infer IR extends MergeQueryIR;
  }
    ? InferMergeParamsFromIR<DB, IR>
    : unknown[];
