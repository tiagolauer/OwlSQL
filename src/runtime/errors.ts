export enum QueryErrorKind {
  EmptyQuery = 'EMPTY_QUERY',
  ExecutorFailed = 'EXECUTOR_FAILED',
}

export interface QueryError {
  kind: QueryErrorKind;
  message: string;
  cause?: unknown;
}

export function describeCause(cause: unknown): string {
  if (cause instanceof Error && cause.message.length > 0) {
    return cause.message;
  }
  return String(cause);
}
