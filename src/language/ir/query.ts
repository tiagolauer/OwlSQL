import type { CteIR } from './cte.js';
import type { ParameterIR } from './parameter.js';
import type { PredicateIR } from './predicate.js';
import type {
  ProjectionIR,
} from './projection.js';
import type { SourceIR } from './source.js';

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
