import type { QueryTypeError } from './public-error.js';
import type { Diagnostic } from './diagnostic.js';

export interface CompileOk<
  Value,
  Diagnostics extends readonly Diagnostic[] = [],
> {
  kind: 'ok';
  value: Value;
  diagnostics: Diagnostics;
}

export interface CompileFatal<
  Value,
  Diagnostics extends readonly Diagnostic[],
> {
  kind: 'fatal';
  readonly __value?: Value;
  diagnostics: Diagnostics;
}

export type Compilation<
  Value,
  Diagnostics extends readonly Diagnostic[] = readonly Diagnostic[],
> = CompileOk<Value, Diagnostics> | CompileFatal<Value, Diagnostics>;

type FirstError<
  Diagnostics extends readonly Diagnostic[],
> = Diagnostics extends readonly [
  infer Head extends Diagnostic,
  ...infer Tail extends Diagnostic[],
]
  ? Head['severity'] extends 'error' | 'fatal'
    ? Head
    : FirstError<Tail>
  : never;

type ProjectError<Value, Error extends Diagnostic> =
  Value extends readonly unknown[]
    ? QueryTypeError<Error['message']>[]
    : QueryTypeError<Error['message']>;

export type ApplyLoosePolicy<CompilationResult> =
  CompilationResult extends CompileOk<infer Value, readonly Diagnostic[]>
    ? Value
    : CompilationResult extends CompileFatal<infer Value, infer Diagnostics>
      ? FirstError<Diagnostics> extends infer Error extends Diagnostic
        ? ProjectError<Value, Error>
        : never
      : never;

export type ApplyStrictPolicy<CompilationResult> =
  CompilationResult extends CompileOk<infer Value, infer Diagnostics>
    ? [FirstError<Diagnostics>] extends [never]
      ? Value
      : FirstError<Diagnostics> extends infer Error extends Diagnostic
        ? ProjectError<Value, Error>
        : never
    : CompilationResult extends CompileFatal<infer Value, infer Diagnostics>
      ? FirstError<Diagnostics> extends infer Error extends Diagnostic
        ? ProjectError<Value, Error>
        : never
      : never;
