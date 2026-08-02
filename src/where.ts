import type { Trim, FirstWord, DropFirstWord, IsKeyword, ExtractParenGroup } from './string.js';
import type { TakeUntilClauseBoundary } from './from.js';
import type {
  SplitAtTopLevelKeyword,
  SchemaLike,
  Source,
  ResolveColumnType,
  QueryTypeError,
} from './parse.js';
import type { IsPlaceholder, CleanColumnToken } from './params.js';

export type ExtractSelectWhereText<AfterFromRest extends string> = Trim<AfterFromRest> extends ''
  ? ''
  : IsKeyword<FirstWord<Trim<AfterFromRest>>, 'where'> extends true
    ? TakeUntilClauseBoundary<DropFirstWord<Trim<AfterFromRest>>>
    : '';

// Depth-tracked, because a SET assignment can hold a subquery with a WHERE of
// its own. Reading the first `where` in the string picked that one up: the
// subquery's columns were checked against the outer target and the real WHERE
// went unchecked, so a valid statement errored and a typo in the clause that
// matters passed (issue #280). The [never] guard is load-bearing the same way
// it is in ExtraSourcesAfterKeyword: SplitAtTopLevelKeyword resolves to never
// when there is no top-level WHERE, and `never extends { after: infer R
// extends string }` passes with R inferred as `string`.
export type ExtractUpdateDeleteWhereText<S extends string> = [
  SplitAtTopLevelKeyword<S, 'where'>,
] extends [never]
  ? ''
  : SplitAtTopLevelKeyword<S, 'where'> extends { after: infer Rest extends string }
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

// Mirrors `IsTransparentToken` in params.ts (which lists `not`): `not` must not
// overwrite `Prev`, otherwise it clobbers the real column just before a word
// operator (`like`/`in`/`between`/`ilike`) fires, so the validator checks the
// literal word `not` instead of the column (`NOT LIKE` / `NOT IN` / `NOT BETWEEN`).
type IsTransparentToken<Token extends string> = Lowercase<Token> extends 'not' ? true : false;

// `and`/`or` separate comparisons in a WHERE clause. They are neither trigger
// operators nor transparent tokens, so without special handling the RHS operand
// of the comparison immediately before them (held in `Prev`) would be silently
// overwritten by the next token and never reach `ValidateWhereOperand` (issue
// #148). Treat them as validation boundaries: validate the accumulated `Prev`
// exactly the way the operator branch does, then reset scanning state so the
// next comparison's LHS operand starts fresh. `between`'s syntactic `and`
// (`x between 1 and 2`) is validated too, but its bounds are literals or real
// columns, so the check is harmless there.
type IsAndOr<Token extends string> = Lowercase<Token> extends 'and' | 'or' ? true : false;

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

// A correlated subquery references a column of the query it sits inside, which
// is ordinary SQL - the README's own scalar-subquery example is one. The inner
// scan only ever saw the inner query's sources, so every such reference read as
// unknown (issue #273).
//
// The outer sources are a fallback rather than an addition to the scope: SQL
// resolves the inner name first and only looks outward when it is not there, so
// merging the two lists would instead invent an `ambiguous column` for every
// name the two levels share. When the outer lookup fails too, the inner
// message is the one reported - the reference was meant for the inner query.
type ValidateWhereOperand<
  DB extends SchemaLike,
  Sources extends Source[],
  Operand extends string,
  OuterSources extends Source[] = [],
> = Operand extends '' ? never : IsPlaceholder<Operand> extends true ? never : ResolveColumnType<
  DB,
  Sources,
  Operand,
  true
> extends QueryTypeError<infer Message>
  ? OuterSources extends []
    ? QueryTypeError<Message>
    : ResolveColumnType<DB, OuterSources, Operand, true> extends QueryTypeError<string>
      ? QueryTypeError<Message>
      : never
  : never;

type WhereScan<
  DB extends SchemaLike,
  Sources extends Source[],
  S extends string,
  Prev extends string = '',
  OuterSources extends Source[] = [],
> = S extends `${infer Head} ${infer Tail}`
  ? HeadStartsSubquery<Head, Tail> extends true
    ? ExtractParenGroup<`${DropOneOpenParen<Head>} ${Tail}`> extends { rest: infer Rest extends string }
      ? WhereScan<DB, Sources, Trim<Rest>, '', OuterSources>
      : never
    : IsTriggerOperator<Head> extends true
      ? ValidateWhereOperand<DB, Sources, Prev, OuterSources> extends infer Error
        ? [Error] extends [never]
          ? WhereScan<DB, Sources, Tail, CleanColumnToken<Head>, OuterSources>
          : Error
        : never
      : IsAndOr<Head> extends true
        ? ValidateWhereOperand<DB, Sources, Prev, OuterSources> extends infer Error
          ? [Error] extends [never]
            ? WhereScan<DB, Sources, Tail, '', OuterSources>
            : Error
          : never
        : IsTransparentToken<Head> extends true
          ? WhereScan<DB, Sources, Tail, Prev, OuterSources>
          : WhereScan<DB, Sources, Tail, CleanColumnToken<Head>, OuterSources>
  : // Terminal case: no trailing space left, so `S` is the final token of the
    // clause. Earlier operands are validated by the operator *after* them, but
    // the trailing operand has no following operator to trigger the check — so
    // validate it here, mirroring the operator branch's `CleanColumnToken`
    // handling (issue #128). `not` is transparent, and empty/placeholder
    // operands are already short-circuited inside `ValidateWhereOperand`.
    IsTransparentToken<S> extends true
    ? never
    : ValidateWhereOperand<DB, Sources, CleanColumnToken<S>, OuterSources>;

export type WhereClauseError<
  DB extends SchemaLike,
  Sources extends Source[],
  WhereText extends string,
  OuterSources extends Source[] = [],
> = WhereScan<DB, Sources, Trim<WhereText>, '', OuterSources>;
