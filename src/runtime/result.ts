export enum ResultStatus {
  Ok = 'OK',
  Error = 'ERROR',
}

export interface QueryMeta {
  rowCount?: number | bigint;
  lastInsertRowid?: number | bigint;
}

export interface Ok<T> {
  status: ResultStatus.Ok;
  value: T;
  meta?: QueryMeta;
}

export interface Err<E> {
  status: ResultStatus.Error;
  error: E;
}

export type Result<T, E> = Ok<T> | Err<E>;

export function ok<T>(value: T, meta?: QueryMeta): Ok<T> {
  return meta === undefined
    ? { status: ResultStatus.Ok, value }
    : { status: ResultStatus.Ok, value, meta };
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
