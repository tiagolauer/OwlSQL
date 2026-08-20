import type { SourceIR } from '../../language/ir/source.js';

export interface Scope<
  Sources extends readonly SourceIR[],
  Parent = null,
> {
  sources: Sources;
  parent: Parent;
}

export type RootScope<Sources extends readonly SourceIR[]> = Scope<Sources>;

export type ChildScope<
  Sources extends readonly SourceIR[],
  Parent,
> = Scope<Sources, Parent>;
