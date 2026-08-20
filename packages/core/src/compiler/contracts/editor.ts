import type {
  DiagnosticLocation,
  QueryDiagnosticCode,
} from './diagnostic.js';

export interface EditorDiagnostic<
  Code extends QueryDiagnosticCode = QueryDiagnosticCode,
> {
  code: Code;
  message: string;
  location: DiagnosticLocation;
  reference: string;
}

export interface CompletionContext {
  clause: 'select' | 'from' | 'join-on' | 'where' | 'having' | 'unknown';
  qualifier?: string | undefined;
}

export interface QueryAnalysis {
  diagnostics: readonly EditorDiagnostic[];
  context: CompletionContext;
}
