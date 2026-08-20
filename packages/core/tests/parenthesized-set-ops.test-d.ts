import type { Query, StrictQuery, Row, QueryTypeError } from '../src/index.js';

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

type ParenthesizedUnion = Expect<
  Equal<Query<DB, '(select id from users) union (select id from archived_users)'>, { id: number }[]>
>;

type ParenthesizedUnionAll = Expect<
  Equal<
    Query<DB, '(select id, name from users) union all (select id, name from archived_users)'>,
    { id: number; name: string }[]
  >
>;

type ParenthesizedBranchWithOrderAndLimit = Expect<
  Equal<
    Query<DB, '(select id from users order by id limit 5) union (select id from archived_users limit 5)'>,
    { id: number }[]
  >
>;

type SingleParenthesizedSelect = Expect<
  Equal<Query<DB, '(select id from users)'>, { id: number }[]>
>;

type ParenthesizedUnionInStrictMode = Expect<
  Equal<
    StrictQuery<DB, '(select id from users) union (select id from archived_users)'>,
    { id: number }[]
  >
>;

type StrictStillCatchesATypoInAParenthesizedBranch = Expect<
  Equal<
    StrictQuery<DB, '(select naem from users) union (select name from archived_users)'>,
    QueryTypeError<'unknown column: naem'>[]
  >
>;

type UnparenthesizedUnionUnchanged = Expect<
  Equal<Query<DB, 'select id from users union select id from archived_users'>, { id: number }[]>
>;

type PlainSelectUnchanged = Expect<Equal<Row<DB, 'select id, name from users'>, { id: number; name: string }>>;

export type {
  ParenthesizedUnion,
  ParenthesizedUnionAll,
  ParenthesizedBranchWithOrderAndLimit,
  SingleParenthesizedSelect,
  ParenthesizedUnionInStrictMode,
  StrictStillCatchesATypoInAParenthesizedBranch,
  UnparenthesizedUnionUnchanged,
  PlainSelectUnchanged,
};
