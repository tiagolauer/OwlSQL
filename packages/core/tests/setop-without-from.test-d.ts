import type { Query, Row } from '../src/index.js';

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;

type Expect<T extends true> = T;

interface DB {
  users: {
    id: number;
    name: string;
  };
  archived_users: {
    id: number;
    name: string;
  };
}

type UnionOfLiterals = Expect<Equal<Row<DB, 'select 1 union select 2'>, { 1: number }>>;

type UnionAllOfLiterals = Expect<Equal<Row<DB, 'select 1 as n union all select 2'>, { n: number }>>;

type IntersectOfLiterals = Expect<Equal<Row<DB, 'select 1 intersect select 2'>, { 1: number }>>;

type ExceptOfLiterals = Expect<Equal<Row<DB, 'select 1 except select 2'>, { 1: number }>>;

// The recursive counter every WITH RECURSIVE tutorial opens with: the anchor
// branch is a bare `select 1`, so the CTE's column list renames it to `n`.
type RecursiveCounter = Expect<
  Equal<
    Query<DB, 'with recursive t(n) as (select 1 union all select n + 1 from t where n < 10) select n from t'>,
    { n: number }[]
  >
>;

type FirstBranchWithFromUnchanged = Expect<
  Equal<Row<DB, 'select id from users union select 2'>, { id: number }>
>;

type BothBranchesWithFromUnchanged = Expect<
  Equal<
    Row<DB, 'select id, name from users union all select id, name from archived_users'>,
    { id: number; name: string }
  >
>;

// `union` inside a parenthesized subquery in the select list is not the
// statement's own set operator, so the column scan must not stop there.
// A scalar subquery is nullable (no row yields NULL), and its own shape comes
// from its first branch, so this matches a plain `(select 1)`.
type UnionInsideASubqueryDoesNotStopTheScan = Expect<
  Equal<
    Row<DB, 'select (select 1 union select 2) as sub, id from users'>,
    { sub: number | null; id: number }
  >
>;

type PlainLiteralSelectUnchanged = Expect<Equal<Row<DB, 'select 1'>, { 1: number }>>;

// A column actually called `union` stays a column.
type ColumnNamedUnionUnchanged = Expect<
  Equal<Row<{ t: { union: number } }, 'select "union" from t'>, { union: number }>
>;

export type {
  UnionOfLiterals,
  UnionAllOfLiterals,
  IntersectOfLiterals,
  ExceptOfLiterals,
  RecursiveCounter,
  FirstBranchWithFromUnchanged,
  BothBranchesWithFromUnchanged,
  UnionInsideASubqueryDoesNotStopTheScan,
  PlainLiteralSelectUnchanged,
  ColumnNamedUnionUnchanged,
};
