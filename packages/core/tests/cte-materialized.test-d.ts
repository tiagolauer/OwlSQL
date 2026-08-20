import type { Query, StrictQuery, Params, QueryTypeError } from '../src/index.js';

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
    total: number;
  };
}

type Materialized = Expect<
  Equal<Query<DB, 'with t as materialized (select id from users) select id from t'>, { id: number }[]>
>;

type NotMaterialized = Expect<
  Equal<
    Query<DB, 'with t as not materialized (select id, name from users) select id, name from t'>,
    { id: number; name: string }[]
  >
>;

type MaterializedInStrictMode = Expect<
  Equal<
    StrictQuery<DB, 'with t as materialized (select id from users) select id from t'>,
    { id: number }[]
  >
>;

type StrictStillCatchesATypoInsideAMaterializedCte = Expect<
  Equal<
    StrictQuery<DB, 'with t as materialized (select naem from users) select naem from t'>,
    QueryTypeError<'unknown column: naem'>[]
  >
>;

type MaterializedAlongsideAPlainCte = Expect<
  Equal<
    Query<
      DB,
      'with a as (select id from users), b as materialized (select user_id from orders) select id from a'
    >,
    { id: number }[]
  >
>;

type MaterializedKeepsParamInference = Expect<
  Equal<
    Params<DB, 'with t as materialized (select id from users where id = $1) select id from t'>,
    [number]
  >
>;

type RecursiveAndMaterializedTogether = Expect<
  Equal<
    Query<DB, 'with recursive t as materialized (select id from users) select id from t'>,
    { id: number }[]
  >
>;

type PlainCteUnchanged = Expect<
  Equal<Query<DB, 'with t as (select id from users) select id from t'>, { id: number }[]>
>;

// A column named `materialized` is still a column, not the hint.
type ColumnCalledMaterializedUnchanged = Expect<
  Equal<Query<{ t: { materialized: number } }, 'select materialized from t'>, { materialized: number }[]>
>;

export type {
  Materialized,
  NotMaterialized,
  MaterializedInStrictMode,
  StrictStillCatchesATypoInsideAMaterializedCte,
  MaterializedAlongsideAPlainCte,
  MaterializedKeepsParamInference,
  RecursiveAndMaterializedTogether,
  PlainCteUnchanged,
  ColumnCalledMaterializedUnchanged,
};
