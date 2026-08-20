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
    email: string;
  };
}

type UnaliasedArithmeticKeepsFullText = Expect<
  Equal<Query<DB, 'select id * 2 from users'>, { 'id * 2': unknown }[]>
>;

type UnaliasedArithmeticStrictHasNoFalsePositive = Expect<
  Equal<StrictRow<DB, 'select id * 2 from users'>, { 'id * 2': unknown }>
>;

type AliasedArithmeticUsesAlias = Expect<
  Equal<Query<DB, 'select id * 2 as doubled from users'>, { doubled: unknown }[]>
>;

type ConcatExpressionKeepsFullText = Expect<
  Equal<
    Query<DB, 'select name || email from users'>,
    { 'name || email': unknown }[]
  >
>;

type WindowFunctionWithAttachedParenResolves = Expect<
  Equal<
    Query<DB, 'select row_number() over(order by id) from users'>,
    { row_number: number }[]
  >
>;

type WindowFunctionWithAttachedParenAndAlias = Expect<
  Equal<
    Query<DB, 'select row_number() over(order by id) as rn from users'>,
    { rn: number }[]
  >
>;

type WindowFunctionWithAttachedParenImplicitAlias = Expect<
  Equal<
    Query<DB, 'select row_number() over(partition by name) rn from users'>,
    { rn: number }[]
  >
>;

type SpacedOverStillResolves = Expect<
  Equal<
    Query<DB, 'select row_number() over (order by id) as rn from users'>,
    { rn: number }[]
  >
>;

type ImplicitAliasStillWorks = Expect<
  Equal<Query<DB, 'select name handle from users'>, { handle: string }[]>
>;

export type Assertions = [
  UnaliasedArithmeticKeepsFullText,
  UnaliasedArithmeticStrictHasNoFalsePositive,
  AliasedArithmeticUsesAlias,
  ConcatExpressionKeepsFullText,
  WindowFunctionWithAttachedParenResolves,
  WindowFunctionWithAttachedParenAndAlias,
  WindowFunctionWithAttachedParenImplicitAlias,
  SpacedOverStillResolves,
  ImplicitAliasStillWorks,
];
