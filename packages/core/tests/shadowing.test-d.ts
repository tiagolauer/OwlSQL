import type { Query, StrictQuery, QueryTypeError } from '../src/index.js';

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;

type Expect<T extends true> = T;

interface DB {
  users: {
    id: number;
    name: string;
  };
  orders: {
    id: number;
    user_id: number;
  };
}

// Inside `t`, the name `users` is the CTE declared just before it, which
// projects only `id`. `name` does not exist there.
type CteShadowsInsideALaterCteBody = Expect<
  Equal<
    StrictQuery<DB, 'with users as (select id from users), t as (select name from users) select name from t'>,
    QueryTypeError<'unknown column: name'>[]
  >
>;

type CteShadowsInsideALaterCteBodyLoose = Expect<
  Equal<
    Query<DB, 'with users as (select id from users), t as (select id from users) select id from t'>,
    { id: number }[]
  >
>;

// A FROM alias hides the real table of the same name, so only `id` is in scope.
type DerivedAliasShadowsTheRealTable = Expect<
  Equal<
    StrictQuery<DB, 'select name from (select id from users) users'>,
    QueryTypeError<'unknown column: name'>[]
  >
>;

type DerivedAliasStillExposesItsOwnColumns = Expect<
  Equal<StrictQuery<DB, 'select id from (select id from users) users'>, { id: number }[]>
>;

// The outer query already shadowed correctly; pinned so it stays that way.
type CteShadowsInTheOuterQuery = Expect<
  Equal<
    StrictQuery<DB, 'with users as (select id from users) select name from users'>,
    QueryTypeError<'unknown column: name'>[]
  >
>;

type CteReferringToAnEarlierCteUnchanged = Expect<
  Equal<
    Query<DB, 'with a as (select id from users), b as (select id from a) select id from b'>,
    { id: number }[]
  >
>;

type UnshadowedTableStillVisibleFromACteBody = Expect<
  Equal<
    Query<DB, 'with t as (select user_id from orders) select user_id from t'>,
    { user_id: number }[]
  >
>;

type DerivedTableWithAFreshAliasUnchanged = Expect<
  Equal<Query<DB, 'select id from (select id from users) u'>, { id: number }[]>
>;

type PlainQueryUnchanged = Expect<
  Equal<Query<DB, 'select id, name from users'>, { id: number; name: string }[]>
>;

export type {
  CteShadowsInsideALaterCteBody,
  CteShadowsInsideALaterCteBodyLoose,
  DerivedAliasShadowsTheRealTable,
  DerivedAliasStillExposesItsOwnColumns,
  CteShadowsInTheOuterQuery,
  CteReferringToAnEarlierCteUnchanged,
  UnshadowedTableStillVisibleFromACteBody,
  DerivedTableWithAFreshAliasUnchanged,
  PlainQueryUnchanged,
};
