import type { QueryMeta } from './result.js';

export type ExecutorResult =
  | unknown[]
  | { rows: unknown[]; meta?: QueryMeta };

export type Executor = (
  sql: string,
  params: readonly unknown[],
) => Promise<ExecutorResult>;

export type PlaceholderStyle = 'dollar' | 'question' | 'at';

export type DialectExecutor<
  Style extends PlaceholderStyle = PlaceholderStyle,
> = Executor & {
  readonly __placeholderStyle?: Style;
};
