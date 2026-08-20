import type { PredicateIR } from '../../language/ir/predicate.js';
import type { ProjectionIR, SelectQueryIR } from '../../language/ir/query.js';
import type {
  DerivedSourceIR,
  JoinKind,
  SourceIR,
  TableSourceIR,
} from '../../language/ir/source.js';
import type { ParseSelectIR } from '../../language/select/parse-select.js';
import type {
  CompileFatal,
  CompileOk,
} from '../contracts/compilation.js';
import type { Diagnostic } from '../contracts/diagnostic.js';
import type { InferProjections } from './infer-projection.js';
import type { RootScope } from './scope.js';

type CompiledSources<
  Sources extends readonly SourceIR[],
  Diagnostics extends readonly Diagnostic[],
> = {
  sources: Sources;
  diagnostics: Diagnostics;
};

type CompileSourceList<
  DB,
  Sources extends readonly SourceIR[],
  Result extends readonly SourceIR[] = [],
  Diagnostics extends readonly Diagnostic[] = [],
> = Sources extends readonly [
  infer Head extends SourceIR,
  ...infer Tail extends SourceIR[],
]
  ? Head extends DerivedSourceIR<
      infer Alias,
      infer Query extends string,
      infer Nullable,
      infer Join extends JoinKind
    >
    ? CompileSelect<DB, Query> extends infer Nested
      ? Nested extends CompileOk<infer Rows extends readonly unknown[], infer NestedDiagnostics>
        ? CompileSourceList<
            DB,
            Tail,
            [
              ...Result,
              DerivedSourceIR<Alias, Rows[number], Nullable, Join>,
            ],
            [...Diagnostics, ...NestedDiagnostics]
          >
        : Nested extends CompileFatal<unknown[], infer NestedDiagnostics>
          ? CompileFatal<unknown[], [...Diagnostics, ...NestedDiagnostics]>
          : never
      : never
    : Head extends TableSourceIR<
        string,
        string,
        boolean,
        JoinKind,
        readonly string[]
      >
      ? CompileSourceList<DB, Tail, [...Result, Head], Diagnostics>
      : never
  : CompiledSources<Result, Diagnostics>;

type CompileIR<
  DB,
  IR extends SelectQueryIR,
> = IR extends SelectQueryIR<
  infer Sources extends readonly SourceIR[],
  infer Projections extends readonly ProjectionIR[],
  readonly PredicateIR[],
  readonly [],
  readonly []
>
  ? CompileSourceList<DB, Sources> extends infer Compiled
    ? Compiled extends CompiledSources<
        infer ResolvedSources,
        infer SourceDiagnostics
      >
      ? InferProjections<
          DB,
          RootScope<ResolvedSources>,
          Projections,
          {},
          SourceDiagnostics
        > extends {
          row: infer Row;
          diagnostics: infer Diagnostics extends readonly Diagnostic[];
        }
        ? CompileOk<Row[], Diagnostics>
        : never
      : Compiled extends CompileFatal<unknown[], infer Diagnostics>
        ? CompileFatal<unknown[], Diagnostics>
        : never
    : never
  : never;

export type CompileSelect<DB, Sql extends string> =
  ParseSelectIR<Sql> extends infer Parsed
    ? Parsed extends { kind: 'ok'; value: infer IR extends SelectQueryIR }
      ? CompileIR<DB, IR>
      : Parsed extends CompileFatal<SelectQueryIR, infer Diagnostics>
        ? CompileFatal<unknown[], Diagnostics>
        : never
    : never;
