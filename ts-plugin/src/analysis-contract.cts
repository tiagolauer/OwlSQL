export type QueryDiagnosticCode =
  | 'UNKNOWN_TABLE'
  | 'UNKNOWN_COLUMN'
  | 'UNKNOWN_ALIAS'
  | 'AMBIGUOUS_COLUMN'
  | 'PARAM_TYPE_CONFLICT'
  | 'PARAM_STYLE_MISMATCH'
  | 'UNSUPPORTED_STATEMENT'
  | 'MALFORMED_QUERY'
  | 'MULTIPLE_STATEMENTS'
  | 'INVALID_WRITE_TARGET'
  | 'INVALID_SCALAR_SUBQUERY'
  | 'UNSUPPORTED_DIALECT_FEATURE'
  | 'UNSUPPORTED_EXPRESSION';

export type DiagnosticLocation =
  | 'statement'
  | 'select'
  | 'from'
  | 'join-on'
  | 'where'
  | 'having'
  | 'returning'
  | 'output'
  | 'parameter'
  | 'cte';

export interface PluginDiagnostic<
  Code extends QueryDiagnosticCode = QueryDiagnosticCode,
> {
  code: Code;
  message: string;
  location: DiagnosticLocation;
  reference: string;
  start: number;
  length: number;
}
