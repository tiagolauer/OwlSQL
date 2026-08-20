import type { ProjectionIR } from './projection.js';

export interface WriteTargetIR<
  Name extends string = string,
  Alias extends string = Name,
> {
  kind: 'write-target';
  name: Name;
  alias: Alias;
}

export interface AssignmentIR<
  Target extends string = string,
  ValueFragment extends string = string,
> {
  target: Target;
  value: ValueFragment;
}

export interface OutputIR<
  Mode extends 'none' | 'returning' | 'output' = 'none',
  Projections extends readonly ProjectionIR[] = [],
> {
  mode: Mode;
  projections: Projections;
}
