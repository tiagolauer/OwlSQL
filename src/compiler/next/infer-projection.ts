import type { ProjectionIR } from '../../language/ir/query.js';
import type {
  ColumnProjectionIR,
  ExpressionProjectionIR,
  StarProjectionIR,
} from '../../language/ir/projection.js';
import type {
  DerivedSourceIR,
  JoinKind,
  SourceIR,
  TableSourceIR,
} from '../../language/ir/source.js';
import type { Diagnostic } from '../contracts/diagnostic.js';
import type { ResolveKey, TableRow } from '../schema/model.js';
import type { InferExpression } from './infer-expression.js';
import type { ResolveColumn } from './resolve-column.js';
import type { ResolveBinding } from './resolve-source.js';
import type { Scope } from './scope.js';

type AddProperty<Row, Name extends string, Value> = Row & {
  [Key in Name]: Value;
};

type Flatten<Value> = { [Key in keyof Value]: Value[Key] };

type ProjectionResult<Row, Diagnostics extends readonly Diagnostic[]> = {
  row: Row;
  diagnostics: Diagnostics;
};

type UnknownTable<Name extends string> = Diagnostic<
  'UNKNOWN_TABLE',
  `unknown table: ${Name}`,
  'error',
  'from',
  Name
>;

type Nullify<Row, Nullable extends boolean> = Nullable extends true
  ? { [Key in keyof Row]: Row[Key] | null }
  : Row;

type SourceColumns<DB, Source extends SourceIR> =
  Source extends TableSourceIR<
    infer Name,
    string,
    infer Nullable,
    JoinKind,
    readonly string[]
  >
    ? ResolveKey<DB, Name> extends never
      ? ProjectionResult<{}, [UnknownTable<Name>]>
      : ProjectionResult<Nullify<TableRow<DB, Name>, Nullable>, []>
    : Source extends DerivedSourceIR<
          string,
          infer Row,
          infer Nullable,
          JoinKind
        >
      ? ProjectionResult<Nullify<Row, Nullable>, []>
      : ProjectionResult<{}, []>;

type ExpandSources<
  DB,
  Sources extends readonly SourceIR[],
  Row = {},
  Diagnostics extends readonly Diagnostic[] = [],
> = Sources extends readonly [
  infer Head extends SourceIR,
  ...infer Tail extends SourceIR[],
]
  ? SourceColumns<DB, Head> extends ProjectionResult<
      infer Columns,
      infer SourceDiagnostics
    >
    ? ExpandSources<
        DB,
        Tail,
        Row & Columns,
        [...Diagnostics, ...SourceDiagnostics]
      >
    : never
  : ProjectionResult<Row, Diagnostics>;

type InferStar<
  DB,
  CurrentScope,
  Qualifier extends string | null,
  Row,
  Diagnostics extends readonly Diagnostic[],
> = CurrentScope extends Scope<infer Sources, unknown>
  ? Qualifier extends string
    ? ResolveBinding<CurrentScope, Qualifier> extends infer Binding
      ? Binding extends { kind: 'ok'; value: infer Source extends SourceIR }
        ? SourceColumns<DB, Source> extends ProjectionResult<
            infer Columns,
            infer StarDiagnostics
          >
          ? ProjectionResult<
              Row & Columns,
              [...Diagnostics, ...StarDiagnostics]
            >
          : never
        : Binding extends {
            kind: 'error';
            diagnostic: infer Error extends Diagnostic;
          }
          ? ProjectionResult<Row, [...Diagnostics, Error]>
          : never
      : never
    : ExpandSources<DB, Sources> extends ProjectionResult<
        infer Columns,
        infer StarDiagnostics
      >
      ? ProjectionResult<Row & Columns, [...Diagnostics, ...StarDiagnostics]>
      : never
  : never;

type InferColumn<
  DB,
  CurrentScope,
  Projection extends ColumnProjectionIR,
  Row,
  Diagnostics extends readonly Diagnostic[],
> = ResolveColumn<
  DB,
  CurrentScope,
  Projection['qualifier'],
  Projection['name']
> extends infer Resolution
  ? Resolution extends { kind: 'ok'; value: infer Value }
    ? ProjectionResult<
        AddProperty<Row, Projection['outputName'], Value>,
        Diagnostics
      >
    : Resolution extends {
          kind: 'error';
          diagnostic: infer Error extends Diagnostic;
        }
      ? ProjectionResult<
          AddProperty<Row, Projection['outputName'], unknown>,
          [...Diagnostics, Error]
        >
      : never
  : never;

type InferOne<
  DB,
  CurrentScope,
  Projection extends ProjectionIR,
  Row,
  Diagnostics extends readonly Diagnostic[],
> = Projection extends ColumnProjectionIR
  ? InferColumn<DB, CurrentScope, Projection, Row, Diagnostics>
  : Projection extends ExpressionProjectionIR
    ? InferExpression<
        DB,
        CurrentScope,
        Projection['fragment']
      > extends {
        value: infer Value;
        diagnostics: infer ExpressionDiagnostics extends readonly Diagnostic[];
      }
      ? ProjectionResult<
          AddProperty<Row, Projection['outputName'], Value>,
          [...Diagnostics, ...ExpressionDiagnostics]
        >
      : never
    : Projection extends StarProjectionIR<string | null>
      ? InferStar<
          DB,
          CurrentScope,
          Projection['qualifier'],
          Row,
          Diagnostics
        >
      : never;

export type InferProjections<
  DB,
  CurrentScope,
  Projections extends readonly ProjectionIR[],
  Row = {},
  Diagnostics extends readonly Diagnostic[] = [],
> = Projections extends readonly [
  infer Head extends ProjectionIR,
  ...infer Tail extends ProjectionIR[],
]
  ? InferOne<DB, CurrentScope, Head, Row, Diagnostics> extends ProjectionResult<
      infer NextRow,
      infer NextDiagnostics
    >
    ? InferProjections<DB, CurrentScope, Tail, NextRow, NextDiagnostics>
    : never
  : ProjectionResult<Flatten<Row>, Diagnostics>;
