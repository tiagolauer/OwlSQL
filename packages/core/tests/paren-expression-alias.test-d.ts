import type { Query } from '../src/index.js';

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;

type Expect<T extends true> = T;

interface DB {
  users: { id: number; name: string; age: number };
  posts: { id: number; user_id: number; views: number };
}

// Everything after the closing paren was taken as the alias, so the real one
// was lost inside a key reading `* 2 as x` (issue #290). The value staying
// unknown is fine - an arithmetic expression is not typed - the key is the bug.
type ExpressionContinuingAfterAGroup = Expect<
  Equal<Query<DB, 'select (id + 1) * 2 as x from users'>, { x: unknown }[]>
>;

// Without an AS there is nothing to tell an alias apart from the rest of the
// expression, so the whole entry becomes the key - the same answer the
// bare-entry branch gives for `id + 1 x`. Better than the old `* 2 x`, which
// named a fragment.
type ExpressionContinuingWithoutAs = Expect<
  Equal<Query<DB, 'select (id + 1) * 2 x from users'>, { '(id + 1) * 2 x': unknown }[]>
>;

type DivisionAfterAGroup = Expect<
  Equal<Query<DB, 'select (age + id) / 2 as average from users'>, { average: unknown }[]>
>;

type ContinuationAmongOtherColumns = Expect<
  Equal<
    Query<DB, 'select name, (id + 1) * 2 as doubled from users'>,
    { name: string; doubled: unknown }[]
  >
>;

// Controls: a group followed by a plain alias, by AS, or by nothing at all.
type GroupWithAsAlias = Expect<
  Equal<Query<DB, 'select (id + 1) as next from users'>, { next: unknown }[]>
>;

type GroupWithBareAlias = Expect<
  Equal<Query<DB, 'select (id + 1) next from users'>, { next: unknown }[]>
>;

type ScalarSubqueryWithAlias = Expect<
  Equal<
    Query<DB, 'select (select count(*) from posts) as total from users'>,
    { total: number }[]
  >
>;

type FunctionCallIsUnaffected = Expect<
  Equal<Query<DB, 'select count(*) as total from users'>, { total: number }[]>
>;

export type ParenExpressionAliasLock = [
  ExpressionContinuingAfterAGroup,
  ExpressionContinuingWithoutAs,
  DivisionAfterAGroup,
  ContinuationAmongOtherColumns,
  GroupWithAsAlias,
  GroupWithBareAlias,
  ScalarSubqueryWithAlias,
  FunctionCallIsUnaffected,
];
