export enum ResultStatus {
  Ok = 'OK',
  Error = 'ERROR',
}

export interface Ok<T> {
  status: ResultStatus.Ok;
  value: T;
}

export interface Err<E> {
  status: ResultStatus.Error;
  error: E;
}

export type Result<T, E> = Ok<T> | Err<E>;

export function ok<T>(value: T): Ok<T> {
  return { status: ResultStatus.Ok, value };
}

export function err<E>(error: E): Err<E> {
  return { status: ResultStatus.Error, error };
}

export function isOk<T, E>(result: Result<T, E>): result is Ok<T> {
  return result.status === ResultStatus.Ok;
}

export function isErr<T, E>(result: Result<T, E>): result is Err<E> {
  return result.status === ResultStatus.Error;
}
