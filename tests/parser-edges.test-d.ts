import type { Query, StrictQuery, QueryTypeError } from '../src/index.js';

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2)
    ? true
    : false;

type Expect<T extends true> = T;

interface DB {
  users: { id: number; name: string; top: string };
  orders: { id: number; total: number };
}

type CteColumnRenameSingle = Expect<
  Equal<
    Query<DB, 'with t(x) as (select id from users) select x from t'>,
    { x: number }[]
  >
>;

type CteColumnRenameStrict = Expect<
  Equal<
    StrictQuery<DB, 'with t(x) as (select id from users) select x from t'>,
    { x: number }[]
  >
>;

type CteBodyErrorSurvivesRename = Expect<
  Equal<
    StrictQuery<DB, 'with t(x) as (select nope from users) select x from t'>,
    QueryTypeError<'unknown column: x'>[]
  >
>;

type ScalarSubqueryIsNullable = Expect<
  Equal<
    Query<DB, 'select (select total from orders) as t from users'>,
    { t: number | null }[]
  >
>;

type ScalarCountSubqueryIsNotNullable = Expect<
  Equal<
    Query<DB, 'select (select count(*) from orders) as c from users'>,
    { c: number }[]
  >
>;

type ColumnNamedTopIsNotEaten = Expect<
  Equal<Query<DB, 'select top from users'>, { top: string }[]>
>;

type TopWithCountIsStillStripped = Expect<
  Equal<Query<DB, 'select top 10 id from users'>, { id: number }[]>
>;

type TopWithParenCountIsStillStripped = Expect<
  Equal<Query<DB, 'select top (10) id from users'>, { id: number }[]>
>;

export type Assertions = [
  CteColumnRenameSingle,
  CteColumnRenameStrict,
  CteBodyErrorSurvivesRename,
  ScalarSubqueryIsNullable,
  ScalarCountSubqueryIsNotNullable,
  ColumnNamedTopIsNotEaten,
  TopWithCountIsStillStripped,
  TopWithParenCountIsStillStripped,
];
