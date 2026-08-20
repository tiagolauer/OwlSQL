import type { AnyCteIR, CteIR } from '../../language/ir/cte.js';
import type {
  ExpressionProjectionIR,
  ColumnProjectionIR,
} from '../../language/ir/projection.js';
import type {
  ProjectionIR,
  SelectQueryIR,
} from '../../language/ir/query.js';
import type { CteSourceIR } from '../../language/ir/source.js';
import type {
  ParseWithIR,
  WithQueryIR,
} from '../../language/with/parse-with.js';
import type {
  CompileFatal,
  CompileOk,
} from '../contracts/compilation.js';
import type { Diagnostic } from '../contracts/diagnostic.js';
import type { QueryTypeError } from '../contracts/public-error.js';
import type {
  CompileSelectIR,
  ResolveSelectSources,
} from './compile-select.js';
import type {
  AnyParamState,
  EmptyParamState,
  InferParamsFromIR,
  ParamValues,
} from './infer-params.js';
import type { Scope } from './scope.js';

type ProjectionNames<
  Projections extends readonly ProjectionIR[],
  Names extends readonly string[] = [],
> = Projections extends readonly [
  infer Head extends ProjectionIR,
  ...infer Tail extends ProjectionIR[],
]
    ? Head extends ColumnProjectionIR<string | null, string, infer Name>
      ? ProjectionNames<Tail, [...Names, Name]>
      : Head extends ExpressionProjectionIR<string, infer Name>
        ? ProjectionNames<Tail, [...Names, Name]>
        : ProjectionNames<Tail, Names>
    : Names;

type RenameKeys<
  Row,
  Keys extends readonly string[],
  Names extends readonly string[],
> = Names extends readonly [
  infer Name extends string,
  ...infer NameTail extends string[],
]
  ? Keys extends readonly [
      infer Key extends string,
      ...infer KeyTail extends string[],
    ]
    ? { [Property in Name]: Key extends keyof Row ? Row[Key] : unknown } & RenameKeys<
        Row,
        KeyTail,
        NameTail
      >
    : Record<never, never>
  : Record<never, never>;

type Flatten<Value> = { [Key in keyof Value]: Value[Key] };

export type CteOutput<
  Row,
  Query extends SelectQueryIR,
  Columns extends readonly string[] | null,
> = Columns extends readonly string[]
  ? Flatten<RenameKeys<Row, ProjectionNames<Query['projections']>, Columns>>
  : Row;

type CteBindingRow<
  Row,
  Query extends SelectQueryIR,
  Columns extends readonly string[] | null,
  Diagnostics extends readonly Diagnostic[],
> = Diagnostics extends readonly [] ? CteOutput<Row, Query, Columns> : {};

type CompileCtes<
  DB,
  Ctes extends readonly AnyCteIR[],
  Query extends SelectQueryIR,
  ParentScope,
  ValidatePredicates extends boolean,
  Sources extends readonly CteSourceIR[] = [],
  Diagnostics extends readonly Diagnostic[] = [],
> = Ctes extends readonly [
  infer Head extends CteIR<
    string,
    readonly string[] | null,
    SelectQueryIR,
    boolean
  >,
  ...infer Tail extends AnyCteIR[],
]
  ? CompileSelectIR<
      DB,
      Head['query'],
      Scope<Sources, ParentScope>,
      ValidatePredicates
    > extends infer Compiled
    ? Compiled extends CompileOk<
        infer Rows extends readonly unknown[],
        infer NestedDiagnostics
      >
      ? CompileCtes<
          DB,
          Tail,
          Query,
          ParentScope,
          ValidatePredicates,
          [
            ...Sources,
            CteSourceIR<
              Head['name'],
              CteBindingRow<
                Rows[number],
                Head['query'],
                Head['columns'],
                NestedDiagnostics
              >
            >,
          ],
          Diagnostics
        >
      : Compiled extends CompileFatal<unknown[], infer NestedDiagnostics>
        ? CompileFatal<unknown[], [...Diagnostics, ...NestedDiagnostics]>
        : never
    : never
  : CompileSelectIR<
      DB,
      Query,
      Scope<Sources, ParentScope>,
      ValidatePredicates
    > extends infer Compiled
    ? Compiled extends CompileOk<
        infer Rows extends readonly unknown[],
        infer MainDiagnostics
      >
      ? CompileOk<Rows, [...Diagnostics, ...MainDiagnostics]>
      : Compiled extends CompileFatal<unknown[], infer MainDiagnostics>
        ? CompileFatal<unknown[], [...Diagnostics, ...MainDiagnostics]>
        : never
    : never;

export type CompileWith<
  DB,
  Sql extends string,
  ParentScope = null,
  ValidatePredicates extends boolean = true,
> = ParseWithIR<Sql> extends infer Parsed
  ? Parsed extends {
      kind: 'ok';
      value: infer IR extends WithQueryIR;
    }
    ? CompileCtes<
        DB,
        IR['ctes'],
        IR['query'],
        ParentScope,
        ValidatePredicates
      >
    : Parsed extends CompileFatal<WithQueryIR, infer Diagnostics>
      ? CompileFatal<unknown[], Diagnostics>
      : never
  : never;

type InferCteParams<
  DB,
  Ctes extends readonly AnyCteIR[],
  Query extends SelectQueryIR,
  ParentScope,
  Sources extends readonly CteSourceIR[] = [],
  State extends AnyParamState = EmptyParamState,
> = Ctes extends readonly [
  infer Head extends CteIR<
    string,
    readonly string[] | null,
    SelectQueryIR,
    boolean
  >,
  ...infer Tail extends AnyCteIR[],
]
  ? CompileSelectIR<
      DB,
      Head['query'],
      Scope<Sources, ParentScope>,
      false
    > extends CompileOk<infer Rows extends readonly unknown[], readonly Diagnostic[]>
    ? InferParamsFromIR<
        DB,
        Head['query'],
        State,
        Scope<
          ResolveSelectSources<
            Head['query'],
            Scope<Sources, ParentScope>
          >,
          Scope<Sources, ParentScope>
        >
      > extends infer NextState extends AnyParamState
      ? InferCteParams<
          DB,
          Tail,
          Query,
          ParentScope,
          [
            ...Sources,
            CteSourceIR<
              Head['name'],
              CteOutput<Rows[number], Head['query'], Head['columns']>
            >,
          ],
          NextState
        >
      : never
    : State
  : InferParamsFromIR<
      DB,
      Query,
      State,
      Scope<
        ResolveSelectSources<Query, Scope<Sources, ParentScope>>,
        Scope<Sources, ParentScope>
      >
    >;

export type InferWithParams<DB, Sql extends string, ParentScope = null> =
  ParseWithIR<Sql> extends infer Parsed
    ? Parsed extends {
        kind: 'ok';
        value: infer IR extends WithQueryIR;
      }
      ? InferCteParams<
          DB,
          IR['ctes'],
          IR['query'],
          ParentScope
        > extends infer State extends AnyParamState
        ? ParamValues<State>
        : unknown[]
      : Parsed extends {
          kind: 'fatal';
          diagnostics: readonly [
            infer Error extends { message: string },
            ...unknown[],
          ];
        }
        ? [QueryTypeError<Error['message']>]
        : unknown[]
    : unknown[];
