import type { Params, QueryTypeError, Row, StrictRow } from '../src/index.js';

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;

type Expect<T extends true> = T;

interface DB {
  users: { id: number; 'first name': string };
  'Order Details': { id: number; qty: number; 'unit price': number };
}

// Regression for #247: every splitter in the parser works on spaces, so a
// quoted identifier holding one was torn in half - the row key came out as
// `name"` and strict mode reported `unknown column: "first`.
type QuotedColumnWithASpaceProjects = Expect<
  Equal<Row<DB, 'select "first name" from users'>, { 'first name': string }>
>;

type QuotedColumnWithASpaceIsKnownInStrictMode = Expect<
  Equal<StrictRow<DB, 'select "first name" from users'>, { 'first name': string }>
>;

type QuotedColumnWithASpaceInWhere = Expect<
  Equal<StrictRow<DB, 'select id from users where "first name" = $1'>, { id: number }>
>;

type QuotedColumnWithASpaceTypesItsParameter = Expect<
  Equal<Params<DB, 'select id from users where "first name" = $1'>, [string]>
>;

type QuotedTableWithASpace = Expect<
  Equal<StrictRow<DB, 'select qty from [Order Details]'>, { qty: number }>
>;

type QuotedTableWithASpaceAndAnAlias = Expect<
  Equal<StrictRow<DB, 'select d.qty from [Order Details] d'>, { qty: number }>
>;

type QualifiedQuotedColumnWithASpace = Expect<
  Equal<
    StrictRow<DB, 'select d."unit price" from [Order Details] d'>,
    { 'unit price': number }
  >
>;

type QuotedAliasWithASpace = Expect<
  Equal<Row<DB, 'select id as "user id" from users'>, { 'user id': number }>
>;

type BacktickColumnWithASpace = Expect<
  Equal<Row<DB, 'select `first name` from users'>, { 'first name': string }>
>;

type StarStillMergesTheQuotedTable = Expect<
  Equal<
    StrictRow<DB, 'select * from [Order Details]'>,
    { id: number; qty: number; 'unit price': number }
  >
>;

type QuotedColumnWithASpaceInAJoin = Expect<
  Equal<
    StrictRow<DB, 'select u."first name", d.qty from users u join [Order Details] d on d.id = u.id'>,
    { 'first name': string; qty: number }
  >
>;

// A quoted name without a space keeps behaving exactly as before, and a
// misspelled one is still reported.
type SingleWordQuotedIdentifierIsUnchanged = Expect<
  Equal<StrictRow<DB, 'select "id" from "users"'>, { id: number }>
>;

type UnknownQuotedColumnStillErrors = Expect<
  Equal<
    StrictRow<DB, 'select "last name" from users'>,
    QueryTypeError<'unknown column: last name'>
  >
>;

export type Assertions = [
  QuotedColumnWithASpaceProjects,
  QuotedColumnWithASpaceIsKnownInStrictMode,
  QuotedColumnWithASpaceInWhere,
  QuotedColumnWithASpaceTypesItsParameter,
  QuotedTableWithASpace,
  QuotedTableWithASpaceAndAnAlias,
  QualifiedQuotedColumnWithASpace,
  QuotedAliasWithASpace,
  BacktickColumnWithASpace,
  StarStillMergesTheQuotedTable,
  QuotedColumnWithASpaceInAJoin,
  SingleWordQuotedIdentifierIsUnchanged,
  UnknownQuotedColumnStillErrors,
];
