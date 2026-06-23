import type { Normalize, FirstWord, IsKeyword } from './string.js';
import type {
  Source,
  SchemaLike,
  ParseStatement,
  ResolveColumnLoose,
} from './parse.js';

type Operator = '=' | '<>' | '!=' | '<' | '>' | '<=' | '>=';

type IsOperator<Token extends string> = Token extends Operator ? true : false;

type IsPlaceholder<Token extends string> = Token extends '?'
  ? true
  : Token extends `$${string}`
    ? true
    : false;

type ParamType<
  DB extends SchemaLike,
  Sources extends Source[],
  Column extends string,
  Op extends string,
> = IsOperator<Op> extends true ? ResolveColumnLoose<DB, Sources, Column> : unknown;

type ScanParams<
  S extends string,
  DB extends SchemaLike,
  Sources extends Source[],
  PrevPrev extends string = '',
  Prev extends string = '',
  Accumulated extends unknown[] = [],
> = S extends `${infer Head} ${infer Tail}`
  ? IsPlaceholder<Head> extends true
    ? ScanParams<Tail, DB, Sources, '', '', [...Accumulated, ParamType<DB, Sources, PrevPrev, Prev>]>
    : ScanParams<Tail, DB, Sources, Prev, Head, Accumulated>
  : S extends ''
    ? Accumulated
    : IsPlaceholder<S> extends true
      ? [...Accumulated, ParamType<DB, Sources, PrevPrev, Prev>]
      : Accumulated;

export type InferParams<DB extends SchemaLike, Q extends string> =
  IsKeyword<FirstWord<Normalize<Q>>, 'insert'> extends true
    ? unknown[]
    : [ParseStatement<Q>] extends [never]
      ? unknown[]
      : ParseStatement<Q> extends { sources: infer Sources extends Source[] }
        ? ScanParams<Normalize<Q>, DB, Sources>
        : unknown[];
