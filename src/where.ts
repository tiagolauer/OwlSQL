import type { Trim, FirstWord, DropFirstWord, IsKeyword, ExtractParenGroup } from './string.js';
import type { TakeUntilClauseBoundary } from './from.js';
import type { AfterKeyword, SchemaLike, Source, ResolveColumnType, QueryTypeError } from './parse.js';
import type { IsPlaceholder, CleanScanToken } from './params.js';

export type ExtractSelectWhereText<AfterFromRest extends string> = Trim<AfterFromRest> extends ''
  ? ''
  : IsKeyword<FirstWord<Trim<AfterFromRest>>, 'where'> extends true
    ? TakeUntilClauseBoundary<DropFirstWord<Trim<AfterFromRest>>>
    : '';

export type ExtractUpdateDeleteWhereText<S extends string> = [AfterKeyword<S, 'where'>] extends [never]
  ? ''
  : AfterKeyword<S, 'where'> extends infer Rest extends string
    ? TakeUntilClauseBoundary<Rest>
    : '';

type IsSymbolTriggerOperator<Token extends string> = Token extends
  | '='
  | '<>'
  | '!='
  | '<'
  | '>'
  | '<='
  | '>='
  ? true
  : false;

type IsWordTriggerOperator<Token extends string> = Lowercase<Token> extends
  | 'like'
  | 'ilike'
  | 'in'
  | 'between'
  | 'is'
  ? true
  : false;

type IsTriggerOperator<Token extends string> = IsSymbolTriggerOperator<Token> extends true
  ? true
  : IsWordTriggerOperator<Token>;

type DropOneOpenParen<S extends string> = S extends `(${infer Rest}` ? Rest : S;

type HeadStartsSubquery<Head extends string, Tail extends string> = Head extends `(${string}`
  ? DropOneOpenParen<Head> extends ''
    ? IsKeyword<FirstWord<Trim<Tail>>, 'select'> extends true
      ? true
      : false
    : IsKeyword<FirstWord<Trim<DropOneOpenParen<Head>>>, 'select'> extends true
      ? true
      : false
  : false;

type ValidateWhereOperand<
  DB extends SchemaLike,
  Sources extends Source[],
  Operand extends string,
> = Operand extends '' ? never : IsPlaceholder<Operand> extends true ? never : ResolveColumnType<
  DB,
  Sources,
  Operand,
  true
> extends QueryTypeError<infer Message>
  ? QueryTypeError<Message>
  : never;

type WhereScan<
  DB extends SchemaLike,
  Sources extends Source[],
  S extends string,
  Prev extends string = '',
> = S extends `${infer Head} ${infer Tail}`
  ? HeadStartsSubquery<Head, Tail> extends true
    ? ExtractParenGroup<`${DropOneOpenParen<Head>} ${Tail}`> extends { rest: infer Rest extends string }
      ? WhereScan<DB, Sources, Trim<Rest>>
      : never
    : IsTriggerOperator<Head> extends true
      ? ValidateWhereOperand<DB, Sources, Prev> extends infer Error
        ? [Error] extends [never]
          ? WhereScan<DB, Sources, Tail, CleanScanToken<Head>>
          : Error
        : never
      : WhereScan<DB, Sources, Tail, CleanScanToken<Head>>
  : never;

export type WhereClauseError<
  DB extends SchemaLike,
  Sources extends Source[],
  WhereText extends string,
> = WhereScan<DB, Sources, Trim<WhereText>>;
