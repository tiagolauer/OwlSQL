import type { CteIR } from './cte.js';
import type { ParameterIR } from './parameter.js';
import type { PredicateIR } from './predicate.js';
import type {
  ColumnProjectionIR,
  ExpressionProjectionIR,
  StarProjectionIR,
} from './projection.js';
import type { SourceIR } from './source.js';

export type ProjectionIR =
  | ColumnProjectionIR
  | ExpressionProjectionIR
  | StarProjectionIR<string | null>;

export interface SelectQueryIR<
  Sources extends readonly SourceIR[] = readonly SourceIR[],
  Projections extends readonly ProjectionIR[] = readonly ProjectionIR[],
  Predicates extends readonly PredicateIR[] = readonly PredicateIR[],
  Parameters extends readonly ParameterIR[] = readonly ParameterIR[],
  Ctes extends readonly CteIR[] = readonly CteIR[],
> {
  kind: 'select';
  sources: Sources;
  projections: Projections;
  predicates: Predicates;
  parameters: Parameters;
  ctes: Ctes;
}
