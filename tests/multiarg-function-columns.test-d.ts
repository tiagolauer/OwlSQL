import type { Query } from '../src/index.js';

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2)
    ? true
    : false;

type Expect<T extends true> = T;

interface DB {
  users: { id: number; name: string; age: number };
}

type MultiArgFunctionDoesNotSwallowSiblingColumn = Expect<
  Equal<
    Query<DB, 'select power(age, 2) as squared, id from users'>,
    { squared: number; id: number }[]
  >
>;

type TwoMultiArgFunctionsBothSplitCorrectly = Expect<
  Equal<
    Query<DB, 'select coalesce(name, id) as x, count(*) as total from users'>,
    { x: unknown; total: number }[]
  >
>;

type SingleArgFunctionCallStillWorks = Expect<
  Equal<Query<DB, 'select count(*) from users'>, { count: number }[]>
>;

type PlainColumnListStillWorks = Expect<
  Equal<Query<DB, 'select id, name from users'>, { id: number; name: string }[]>
>;

type ConcatWithSpaceAfterCommaResolvesAlias = Expect<
  Equal<Query<DB, 'select concat(name, name) as full_name from users'>, { full_name: string }[]>
>;

type CountDistinctResolvesAlias = Expect<
  Equal<Query<DB, 'select count(distinct name) as total from users'>, { total: number }[]>
>;

export type BehaviorLock = [
  MultiArgFunctionDoesNotSwallowSiblingColumn,
  TwoMultiArgFunctionsBothSplitCorrectly,
  SingleArgFunctionCallStillWorks,
  PlainColumnListStillWorks,
  ConcatWithSpaceAfterCommaResolvesAlias,
  CountDistinctResolvesAlias,
];
