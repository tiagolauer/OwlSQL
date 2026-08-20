import type { CteIR } from './cte.js';
import type { ParameterIR } from './parameter.js';
import type { PredicateIR } from './predicate.js';
import type {
  ProjectionIR,
} from './projection.js';
import type { SourceIR } from './source.js';
import type {
  AssignmentIR,
  MergeActionIR,
  OutputIR,
  WriteTargetIR,
} from './write.js';

export type { ProjectionIR } from './projection.js';

export interface SelectClausesIR<
  GroupBy extends string = '',
  OrderBy extends string = '',
  Limit extends string = '',
  Offset extends string = '',
  Window extends string = '',
> {
  groupBy: GroupBy;
  orderBy: OrderBy;
  limit: Limit;
  offset: Offset;
  window: Window;
}

export interface SetOperationIR<
  Kind extends 'union' | 'union-all' | 'intersect' | 'except' =
    | 'union'
    | 'union-all'
    | 'intersect'
    | 'except',
  Query = unknown,
> {
  kind: Kind;
  query: Query;
}

export interface SelectQueryIR<
  Sources extends readonly SourceIR[] = readonly SourceIR[],
  Projections extends readonly ProjectionIR[] = readonly ProjectionIR[],
  Predicates extends readonly PredicateIR[] = readonly PredicateIR[],
  Parameters extends readonly ParameterIR[] = readonly ParameterIR[],
  Ctes extends readonly CteIR[] = readonly CteIR[],
  Clauses extends SelectClausesIR<
    string,
    string,
    string,
    string,
    string
  > = SelectClausesIR<string, string, string, string, string>,
  SetOperations extends readonly SetOperationIR[] = readonly SetOperationIR[],
> {
  kind: 'select';
  sources: Sources;
  projections: Projections;
  predicates: Predicates;
  parameters: Parameters;
  ctes: Ctes;
  clauses: Clauses;
  setOperations: SetOperations;
}

export interface InsertValuesIR<
  Rows extends readonly (readonly string[])[] = readonly (readonly string[])[],
  Tail extends string = string,
> {
  mode: 'values';
  rows: Rows;
  tail: Tail;
}

export interface InsertSelectIR<
  Query extends SelectQueryIR = SelectQueryIR,
> {
  mode: 'select';
  query: Query;
}

export interface InsertDefaultValuesIR {
  mode: 'default-values';
}

export type InsertSourceIR =
  | InsertValuesIR
  | InsertSelectIR
  | InsertDefaultValuesIR;

export interface InsertQueryIR<
  Target extends WriteTargetIR = WriteTargetIR,
  Columns extends readonly string[] = readonly string[],
  Source extends InsertSourceIR = InsertSourceIR,
  Output extends OutputIR<
    'none' | 'returning' | 'output',
    readonly ProjectionIR[]
  > = OutputIR<
    'none' | 'returning' | 'output',
    readonly ProjectionIR[]
  >,
> {
  kind: 'insert';
  target: Target;
  columns: Columns;
  source: Source;
  output: Output;
}

export interface UpdateQueryIR<
  Target extends WriteTargetIR = WriteTargetIR,
  Assignments extends readonly AssignmentIR[] = readonly AssignmentIR[],
  Sources extends readonly SourceIR[] = readonly SourceIR[],
  Predicates extends readonly PredicateIR[] = readonly PredicateIR[],
  Output extends OutputIR<
    'none' | 'returning' | 'output',
    readonly ProjectionIR[]
  > = OutputIR<
    'none' | 'returning' | 'output',
    readonly ProjectionIR[]
  >,
> {
  kind: 'update';
  target: Target;
  assignments: Assignments;
  sources: Sources;
  predicates: Predicates;
  output: Output;
}

export interface DeleteQueryIR<
  Target extends WriteTargetIR = WriteTargetIR,
  Sources extends readonly SourceIR[] = readonly SourceIR[],
  Predicates extends readonly PredicateIR[] = readonly PredicateIR[],
  Output extends OutputIR<
    'none' | 'returning' | 'output',
    readonly ProjectionIR[]
  > = OutputIR<
    'none' | 'returning' | 'output',
    readonly ProjectionIR[]
  >,
> {
  kind: 'delete';
  target: Target;
  sources: Sources;
  predicates: Predicates;
  output: Output;
}

export interface MergeQueryIR<
  Target extends WriteTargetIR = WriteTargetIR,
  Sources extends readonly SourceIR[] = readonly SourceIR[],
  Predicates extends readonly PredicateIR[] = readonly PredicateIR[],
  Actions extends readonly MergeActionIR[] = readonly MergeActionIR[],
  Output extends OutputIR<
    'none' | 'returning' | 'output',
    readonly ProjectionIR[]
  > = OutputIR<
    'none' | 'returning' | 'output',
    readonly ProjectionIR[]
  >,
  SourceValues extends readonly string[] = readonly string[],
> {
  kind: 'merge';
  target: Target;
  sources: Sources;
  predicates: Predicates;
  actions: Actions;
  output: Output;
  sourceValues: SourceValues;
}
