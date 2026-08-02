import type { Query } from '../src/index.js';

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2)
    ? true
    : false;

type Expect<T extends true> = T;

interface DB {
  employees: { id: number; dept: string; salary: number };
}

type RowNumberWithAlias = Expect<
  Equal<
    Query<
      DB,
      'select id, row_number() over (partition by dept order by salary desc) as rn from employees'
    >,
    { id: number; rn: number }[]
  >
>;

type RankWithoutAliasDefaultsToFunctionName = Expect<
  Equal<
    Query<DB, 'select rank() over (order by salary desc) from employees'>,
    { rank: number }[]
  >
>;

type EmptyOverClause = Expect<
  Equal<Query<DB, 'select dense_rank() over () as d from employees'>, { d: number }[]>
>;

type WindowFunctionAlongsideRegularColumn = Expect<
  Equal<
    Query<DB, 'select dept, ntile(4) over (order by salary) as bucket from employees'>,
    { dept: string; bucket: number }[]
  >
>;

// Regression for #301: `over w` refers to a window declared in a WINDOW
// clause, the other half of the syntax. Requiring a paren after OVER meant the
// entry was not read as a window expression at all, so it fell to the
// bare-alias split and `over w` became the alias of `sum(salary)`.
type NamedWindowKeepsTheFunctionName = Expect<
  Equal<
    Query<DB, 'select sum(salary) over w from employees window w as (order by id)'>,
    { sum: number }[]
  >
>;

type NamedWindowWithAlias = Expect<
  Equal<
    Query<DB, 'select sum(salary) over w as total from employees window w as (order by id)'>,
    { total: number }[]
  >
>;

type NamedWindowAlongsideRegularColumn = Expect<
  Equal<
    Query<DB, 'select dept, rank() over w from employees window w as (order by salary)'>,
    { dept: string; rank: number }[]
  >
>;

export type WindowLock = [
  RowNumberWithAlias,
  RankWithoutAliasDefaultsToFunctionName,
  EmptyOverClause,
  WindowFunctionAlongsideRegularColumn,
  NamedWindowKeepsTheFunctionName,
  NamedWindowWithAlias,
  NamedWindowAlongsideRegularColumn,
];
