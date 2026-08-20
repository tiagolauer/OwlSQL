import type {
  CompletionContext,
  EditorDiagnostic,
  QueryAnalysis,
} from '../../src/compiler/analysis.js';

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends
  (<T>() => T extends B ? 1 : 2) ? true : false;

type Expect<T extends true> = T;

type UnknownColumn = EditorDiagnostic<'UNKNOWN_COLUMN'>;

type StableDiagnostic = Expect<
  Equal<
    UnknownColumn,
    {
      code: 'UNKNOWN_COLUMN';
      message: string;
      location: import('../../src/compiler/contracts/diagnostic.js').DiagnosticLocation;
      reference: string;
    }
  >
>;

type StableContext = Expect<
  Equal<
    CompletionContext,
    {
      clause: 'select' | 'from' | 'join-on' | 'where' | 'having' | 'unknown';
      qualifier?: string | undefined;
    }
  >
>;

type StableAnalysis = Expect<
  QueryAnalysis extends {
    diagnostics: readonly EditorDiagnostic[];
    context: CompletionContext;
  }
    ? true
    : false
>;

export type EditorContractLock = [StableDiagnostic, StableContext, StableAnalysis];
