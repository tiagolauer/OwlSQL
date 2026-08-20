import type {
  ApplyLoosePolicy,
  ApplyStrictPolicy,
  CompileOk,
} from '../../src/compiler/contracts/compilation.js';
import type {
  Diagnostic,
  QueryDiagnosticCode,
} from '../../src/compiler/contracts/diagnostic.js';
import type { QueryTypeError } from '../../src/public/schema.js';

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends
  (<T>() => T extends B ? 1 : 2) ? true : false;

type Expect<T extends true> = T;

type UnknownColumn = Diagnostic<
  'UNKNOWN_COLUMN',
  'unknown column: nope',
  'error',
  'select',
  'nope'
>;

type CodesAreClosed = Expect<
  Equal<'UNKNOWN_COLUMN' extends QueryDiagnosticCode ? true : false, true>
>;

type Compilation = CompileOk<{ id: number; nope: unknown }[], [UnknownColumn]>;

type LooseKeepsValue = Expect<
  Equal<ApplyLoosePolicy<Compilation>, { id: number; nope: unknown }[]>
>;

type StrictBlocks = Expect<
  Equal<
    ApplyStrictPolicy<Compilation>,
    QueryTypeError<'unknown column: nope'>[]
  >
>;

export type DiagnosticContractLock = [
  CodesAreClosed,
  LooseKeepsValue,
  StrictBlocks,
];
