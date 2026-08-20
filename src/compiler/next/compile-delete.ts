import type { ParseDeleteIR } from '../../language/dml/parse-delete.js';
import type { DeleteQueryIR } from '../../language/ir/query.js';
import type { SourceIR, TableSourceIR } from '../../language/ir/source.js';
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
  ScanPredicateParams,
} from './infer-params.js';
import type { Scope } from './scope.js';

type TargetSource<IR extends DeleteQueryIR> = TableSourceIR<
  IR['target']['name'],
  IR['target']['alias'],
  false,
  'root',
  []
>;

type CompileResolvedDelete<
  DB,
  IR extends DeleteQueryIR,
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

export type CompileDeleteIR<
  DB,
  IR extends DeleteQueryIR,
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
    ? CompileResolvedDelete<
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

export type CompileDelete<
  DB,
  Sql extends string,
  ParentScope = null,
  Validate extends boolean = true,
> = ParseDeleteIR<Sql> extends infer Parsed
  ? Parsed extends { kind: 'ok'; value: infer IR extends DeleteQueryIR }
    ? CompileDeleteIR<DB, IR, ParentScope, Validate>
    : Parsed extends CompileFatal<DeleteQueryIR, infer Diagnostics>
      ? CompileFatal<unknown[], Diagnostics>
      : never
  : never;

export type InferDeleteParamsFromIR<DB, IR extends DeleteQueryIR> =
  ScanPredicateParams<
    DB,
    Scope<[TargetSource<IR>, ...IR['sources']]>,
    IR['predicates'],
    EmptyParamState
  > extends infer State extends AnyParamState
    ? ParamValues<State>
    : unknown[];

export type InferDeleteParams<DB, Sql extends string> =
  ParseDeleteIR<Sql> extends {
    kind: 'ok';
    value: infer IR extends DeleteQueryIR;
  }
    ? InferDeleteParamsFromIR<DB, IR>
    : unknown[];
