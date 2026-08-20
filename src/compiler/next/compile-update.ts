import type { AssignmentIR } from '../../language/ir/write.js';
import type { PredicateIR } from '../../language/ir/predicate.js';
import type { UpdateQueryIR } from '../../language/ir/query.js';
import type { SourceIR, TableSourceIR } from '../../language/ir/source.js';
import type { ParseUpdateIR } from '../../language/dml/parse-update.js';
import type { CompileFatal, CompileOk } from '../contracts/compilation.js';
import type { Diagnostic } from '../contracts/diagnostic.js';
import type {
  AnalyzePredicates,
  CompileSourceList,
  CompiledSources,
} from './compile-select.js';
import type { InferOutput } from './infer-output.js';
import type {
  AnyParamState,
  EmptyParamState,
  ParamValues,
  ScanParamFragment,
  ScanTypedFragment,
} from './infer-params.js';
import type { ResolveWriteColumn } from './resolve-write-target.js';
import type { Scope } from './scope.js';

type TargetSource<IR extends UpdateQueryIR> = TableSourceIR<
  IR['target']['name'],
  IR['target']['alias'],
  false,
  'root',
  []
>;

type AssignmentDiagnostics<
  DB,
  CurrentScope,
  IR extends UpdateQueryIR,
  Assignments extends readonly AssignmentIR[] = IR['assignments'],
  Diagnostics extends readonly Diagnostic[] = [],
> = Assignments extends readonly [
  infer Head extends AssignmentIR,
  ...infer Tail extends AssignmentIR[],
]
  ? ResolveWriteColumn<DB, IR['target'], Head['target']> extends infer Resolved
    ? Resolved extends {
        kind: 'error';
        diagnostic: infer Error extends Diagnostic;
      }
      ? AssignmentDiagnostics<
          DB,
          CurrentScope,
          IR,
          Tail,
          [...Diagnostics, Error]
        >
      : AssignmentDiagnostics<DB, CurrentScope, IR, Tail, Diagnostics>
    : never
  : Diagnostics;

type CompileResolvedUpdate<
  DB,
  IR extends UpdateQueryIR,
  Sources extends readonly SourceIR[],
  SourceDiagnostics extends readonly Diagnostic[],
  ParentScope,
  Validate extends boolean,
> = InferOutput<
  DB,
  Scope<Sources, ParentScope>,
  IR['output']
> extends CompileOk<infer Rows, infer OutputDiagnostics>
  ? CompileOk<
      Rows,
      [
        ...SourceDiagnostics,
        ...(Validate extends true
          ? AssignmentDiagnostics<DB, Scope<Sources, ParentScope>, IR>
          : []),
        ...(Validate extends true
          ? AnalyzePredicates<
              DB,
              Scope<Sources, ParentScope>,
              IR['predicates']
            >
          : []),
        ...OutputDiagnostics,
      ]
    >
  : never;

export type CompileUpdateIR<
  DB,
  IR extends UpdateQueryIR,
  ParentScope = null,
  Validate extends boolean = true,
> = CompileSourceList<
  DB,
  [TargetSource<IR>, ...IR['sources']],
  ParentScope,
  Validate
> extends infer Compiled
  ? Compiled extends CompiledSources<
      infer Sources,
      infer SourceDiagnostics
    >
    ? CompileResolvedUpdate<
        DB,
        IR,
        Sources,
        SourceDiagnostics,
        ParentScope,
        Validate
      >
    : Compiled extends CompileFatal<unknown[], infer Diagnostics>
      ? CompileFatal<unknown[], Diagnostics>
      : never
  : never;

export type CompileUpdate<
  DB,
  Sql extends string,
  ParentScope = null,
  Validate extends boolean = true,
> = ParseUpdateIR<Sql> extends infer Parsed
  ? Parsed extends { kind: 'ok'; value: infer IR extends UpdateQueryIR }
    ? CompileUpdateIR<DB, IR, ParentScope, Validate>
    : Parsed extends CompileFatal<UpdateQueryIR, infer Diagnostics>
      ? CompileFatal<unknown[], Diagnostics>
      : never
  : never;

type AssignmentValue<
  DB,
  IR extends UpdateQueryIR,
  Target extends string,
> = ResolveWriteColumn<DB, IR['target'], Target> extends {
  kind: 'ok';
  value: infer Value;
}
  ? Value
  : unknown;

type ScanAssignments<
  DB,
  IR extends UpdateQueryIR,
  Assignments extends readonly AssignmentIR[],
  State extends AnyParamState = EmptyParamState,
> = Assignments extends readonly [
  infer Head extends AssignmentIR,
  ...infer Tail extends AssignmentIR[],
]
  ? ScanTypedFragment<
      Head['value'],
      AssignmentValue<DB, IR, Head['target']>,
      State
    > extends infer Next extends AnyParamState
    ? ScanAssignments<DB, IR, Tail, Next>
    : never
  : State;

type ScanPredicates<
  DB,
  CurrentScope,
  Predicates extends readonly PredicateIR[],
  State extends AnyParamState,
> = Predicates extends readonly [
  infer Head extends PredicateIR,
  ...infer Tail extends PredicateIR[],
]
  ? ScanParamFragment<
      DB,
      CurrentScope,
      Head['fragment'],
      State
    > extends infer Next extends AnyParamState
    ? ScanPredicates<DB, CurrentScope, Tail, Next>
    : never
  : State;

export type InferUpdateParamsFromIR<DB, IR extends UpdateQueryIR> =
  ScanAssignments<DB, IR, IR['assignments']> extends infer AssignmentState extends AnyParamState
    ? ScanPredicates<
        DB,
        Scope<[TargetSource<IR>, ...IR['sources']]>,
        IR['predicates'],
        AssignmentState
      > extends infer FinalState extends AnyParamState
      ? ParamValues<FinalState>
      : unknown[]
    : unknown[];

export type InferUpdateParams<DB, Sql extends string> =
  ParseUpdateIR<Sql> extends {
    kind: 'ok';
    value: infer IR extends UpdateQueryIR;
  }
    ? InferUpdateParamsFromIR<DB, IR>
    : unknown[];
