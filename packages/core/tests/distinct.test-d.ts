import type { Query, StrictRow } from '../src/index.js';

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2)
    ? true
    : false;

type Expect<T extends true> = T;

interface DB {
  users: {
    id: number;
    name: string;
    team_id: number;
  };
  users2: {
    onboarding: string;
  };
}

type DistinctColumnsResolve = Expect<
  Equal<
    Query<DB, 'select distinct id, name from users'>,
    { id: number; name: string }[]
  >
>;

type DistinctUppercaseResolves = Expect<
  Equal<Query<DB, 'SELECT DISTINCT id FROM users'>, { id: number }[]>
>;

type AllKeywordStripped = Expect<
  Equal<Query<DB, 'select all id from users'>, { id: number }[]>
>;

type DistinctOnGroupStripped = Expect<
  Equal<
    Query<DB, 'select distinct on (team_id) id, name from users'>,
    { id: number; name: string }[]
  >
>;

type DistinctCombinesWithTop = Expect<
  Equal<Query<DB, 'select distinct top 5 id from users'>, { id: number }[]>
>;

type DistinctStar = Expect<
  Equal<
    Query<DB, 'select distinct * from users'>,
    { id: number; name: string; team_id: number }[]
  >
>;

type StrictDistinctResolves = Expect<
  Equal<StrictRow<DB, 'select distinct id from users'>, { id: number }>
>;

// Regression for #289: Postgres accepts the glued spelling too, and the first
// word of it is `on(team_id)`, which failed the whole-word compare - so the ON
// group leaked into the column list and was read as a call to a function
// named `on`, aliased to the column beside it.
type GluedDistinctOnGroupStripped = Expect<
  Equal<Query<DB, 'select distinct on(team_id) id from users'>, { id: number }[]>
>;

type GluedDistinctOnResolvesInStrictMode = Expect<
  Equal<StrictRow<DB, 'select distinct on(team_id) id, name from users'>, { id: number; name: string }>
>;

type GluedDistinctOnWithMultipleKeys = Expect<
  Equal<Query<DB, 'select distinct on(team_id, name) id from users'>, { id: number }[]>
>;

// A column actually named `on` is still a column, not the keyword.
type ColumnNamedOnIsUnaffected = Expect<
  Equal<Query<DB, 'select distinct onboarding from users2'>, { onboarding: string }[]>
>;

export type Assertions = [
  DistinctColumnsResolve,
  DistinctUppercaseResolves,
  AllKeywordStripped,
  DistinctOnGroupStripped,
  DistinctCombinesWithTop,
  DistinctStar,
  StrictDistinctResolves,
  GluedDistinctOnGroupStripped,
  GluedDistinctOnResolvesInStrictMode,
  GluedDistinctOnWithMultipleKeys,
  ColumnNamedOnIsUnaffected,
];
