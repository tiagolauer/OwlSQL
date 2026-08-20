import type { ProjectionIR } from '../../language/ir/query.js';
import type {
  ColumnProjectionIR,
  ExpressionProjectionIR,
  StarProjectionIR,
} from '../../language/ir/projection.js';
import type { Diagnostic } from '../contracts/diagnostic.js';
import type { ResolveColumn } from './resolve-column.js';

type UnsupportedExpression<Fragment extends string> = Diagnostic<
  'UNSUPPORTED_EXPRESSION',
  `unsupported expression: ${Fragment}`,
  'error',
  'select',
  Fragment
>;

type AddProperty<Row, Name extends string, Value> = Row & {
  [Key in Name]: Value;
};

type Flatten<Value> = { [Key in keyof Value]: Value[Key] };

type ProjectionResult<Row, Diagnostics extends readonly Diagnostic[]> = {
  row: Row;
  diagnostics: Diagnostics;
};

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
    ? ProjectionResult<
        AddProperty<Row, Projection['outputName'], unknown>,
        [...Diagnostics, UnsupportedExpression<Projection['fragment']>]
      >
    : Projection extends StarProjectionIR
      ? ProjectionResult<Row, [...Diagnostics, UnsupportedExpression<'*'>]>
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
