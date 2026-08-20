import type { Query, Params, StrictRow, QueryTypeError } from '../src/index.js';

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2)
    ? true
    : false;

type Expect<T extends true> = T;

interface DB {
  users: { id: number; name: string };
}

type SingleTrailingSemicolonIsFine = Expect<
  Equal<StrictRow<DB, 'select id from users;'>, { id: number }>
>;

type TrailingSemicolonWithSpaceIsFine = Expect<
  Equal<StrictRow<DB, 'select id from users; '>, { id: number }>
>;

type NoSemicolonIsFine = Expect<
  Equal<StrictRow<DB, 'select id from users'>, { id: number }>
>;

type SemicolonInsideLiteralIsFine = Expect<
  Equal<StrictRow<DB, "select id from users where name = 'a;b'">, { id: number }>
>;

type SemicolonInsideDollarQuotedLiteralIsFine = Expect<
  Equal<StrictRow<DB, 'select id from users where name = $$a;b$$'>, { id: number }>
>;

type SemicolonInsideCommentIsFine = Expect<
  Equal<
    StrictRow<
      DB,
      `select id from users -- old query: select name from users;
`
    >,
    { id: number }
  >
>;

// Regression for #232: quoted identifiers are left intact for the parser, so
// their bodies are the last place a raw `;` survives the masking pass.
type SemicolonInsideDoubleQuotedIdentifierIsFine = Expect<
  Equal<Query<DB, 'select "id;x" from users'>, { 'id;x': unknown }[]>
>;

type SemicolonInsideBacktickIdentifierIsFine = Expect<
  Equal<Query<DB, 'select `id;x` from users'>, { 'id;x': unknown }[]>
>;

type SemicolonInsideBracketIdentifierIsFine = Expect<
  Equal<Query<DB, 'select [id;x] from users'>, { 'id;x': unknown }[]>
>;

type QuotedIdentifierDoesNotHideARealStackedStatement = Expect<
  Equal<
    Query<DB, 'select "id" from users; drop table users'>,
    QueryTypeError<'multiple statements are not supported: found a semicolon before the end of the query'>[]
  >
>;

type NonTrailingSemicolonIsRejectedInStrictMode = Expect<
  Equal<
    StrictRow<DB, 'select id from users; select name from users'>,
    QueryTypeError<'multiple statements are not supported: found a semicolon before the end of the query'>
  >
>;

type NonTrailingSemicolonIsRejectedInNonStrictMode = Expect<
  Equal<
    Query<DB, 'select id from users; select name from users'>,
    QueryTypeError<'multiple statements are not supported: found a semicolon before the end of the query'>[]
  >
>;

type NonTrailingSemicolonIsRejectedForParams = Expect<
  Equal<
    Params<DB, 'select id from users where id = ?; delete from users where id = ?'>,
    [QueryTypeError<'multiple statements are not supported: found a semicolon before the end of the query'>]
  >
>;

type TrailingSemicolonStillTypesParams = Expect<
  Equal<Params<DB, 'select id from users where id = ?;'>, [number]>
>;

export type Assertions = [
  SingleTrailingSemicolonIsFine,
  TrailingSemicolonWithSpaceIsFine,
  NoSemicolonIsFine,
  SemicolonInsideLiteralIsFine,
  SemicolonInsideDollarQuotedLiteralIsFine,
  SemicolonInsideCommentIsFine,
  SemicolonInsideDoubleQuotedIdentifierIsFine,
  SemicolonInsideBacktickIdentifierIsFine,
  SemicolonInsideBracketIdentifierIsFine,
  QuotedIdentifierDoesNotHideARealStackedStatement,
  NonTrailingSemicolonIsRejectedInStrictMode,
  NonTrailingSemicolonIsRejectedInNonStrictMode,
  NonTrailingSemicolonIsRejectedForParams,
  TrailingSemicolonStillTypesParams,
];
