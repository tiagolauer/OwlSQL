import type { Query, QueryTypeError, StrictQuery } from '../src/index.js';

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;

type Expect<T extends true> = T;

interface DB {
  users: { id: number; name: string };
  posts: { id: number; user_id: number; views: number };
}

// The README's own scalar-subquery example, run strict. The inner query was
// resolved against its own sources only, so any correlated reference read as
// unknown (issue #273).
type CorrelatedScalarSubquery = Expect<
  Equal<
    StrictQuery<
      DB,
      'select (select count(*) from posts where posts.user_id = users.id) as post_count from users'
    >,
    { post_count: number }[]
  >
>;

type CorrelatedScalarSubqueryThroughAnAlias = Expect<
  Equal<
    StrictQuery<
      DB,
      'select (select count(*) from posts where posts.user_id = u.id) as post_count from users u'
    >,
    { post_count: number }[]
  >
>;

type CorrelatedLateralJoin = Expect<
  Equal<
    StrictQuery<
      DB,
      'select u.name, p.top_id from users u join lateral (select max(id) as top_id from posts where posts.user_id = u.id) p on true'
    >,
    { name: string; top_id: number }[]
  >
>;

type CorrelatedDerivedTable = Expect<
  Equal<
    StrictQuery<
      DB,
      'select u.name, p.top_id from users u join (select max(id) as top_id from posts where posts.user_id = u.id) p on true'
    >,
    { name: string; top_id: number }[]
  >
>;

// A mistake inside the subquery is still a mistake, and the message names it
// rather than the alias the outer query failed to read.
type TypoInsideACorrelatedSubquery = Expect<
  Equal<
    StrictQuery<
      DB,
      'select (select count(*) from posts where posts.nope = users.id) as x from users'
    >,
    QueryTypeError<'unknown column: nope'>[]
  >
>;

type TypoInsideACorrelatedDerivedTable = Expect<
  Equal<
    StrictQuery<
      DB,
      'select u.name, p.top_id from users u join (select max(id) as top_id from posts where posts.nope = u.id) p on true'
    >,
    QueryTypeError<'unknown column: nope'>[]
  >
>;

// An uncorrelated subquery referencing nothing that exists anywhere still
// fails, and a standalone query is not given an outer scope it does not have.
type UnknownAliasWithNoOuterScope = Expect<
  Equal<
    StrictQuery<DB, 'select max(id) as top_id from posts where posts.user_id = u.id'>,
    QueryTypeError<'unknown alias: u'>[]
  >
>;

// Controls: the uncorrelated forms that already worked.
type UncorrelatedScalarSubquery = Expect<
  Equal<
    StrictQuery<DB, 'select (select count(*) from posts) as total from users'>,
    { total: number }[]
  >
>;

type UncorrelatedLateralJoin = Expect<
  Equal<
    StrictQuery<
      DB,
      'select u.name, p.top_id from users u join lateral (select max(id) as top_id from posts) p on true'
    >,
    { name: string; top_id: number }[]
  >
>;

type LooseModeIsUnchanged = Expect<
  Equal<
    Query<
      DB,
      'select (select count(*) from posts where posts.user_id = users.id) as post_count from users'
    >,
    { post_count: number }[]
  >
>;

export type CorrelatedSubqueryLock = [
  CorrelatedScalarSubquery,
  CorrelatedScalarSubqueryThroughAnAlias,
  CorrelatedLateralJoin,
  CorrelatedDerivedTable,
  TypoInsideACorrelatedSubquery,
  TypoInsideACorrelatedDerivedTable,
  UnknownAliasWithNoOuterScope,
  UncorrelatedScalarSubquery,
  UncorrelatedLateralJoin,
  LooseModeIsUnchanged,
];
