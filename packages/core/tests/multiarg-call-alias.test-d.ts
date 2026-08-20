import type { Query, StrictRow } from '../src/index.js';

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;

type Expect<T extends true> = T;

interface DB {
  users: { id: number; name: string; age: number; created_at: Date };
}

// The bare-alias fallback split at the first space with no paren tracking, so
// an unaliased call carrying a space in its arguments was cut in half: the
// tail became a fake alias and the head a fake column name (issue #276).
type MultiArgumentCallKeepsItsName = Expect<
  Equal<Query<DB, 'select power(age, 2) from users'>, { power: number }[]>
>;

type MultiArgumentCallInStrictMode = Expect<
  Equal<StrictRow<DB, 'select power(age, 2) from users'>, { power: number }>
>;

type CastCallKeepsItsName = Expect<
  Equal<Query<DB, 'select cast(id as text) from users'>, { cast: unknown }[]>
>;

type ExtractCallKeepsItsName = Expect<
  Equal<Query<DB, 'select extract(epoch from created_at) from users'>, { extract: unknown }[]>
>;

type CoalesceCallKeepsItsName = Expect<
  Equal<Query<DB, "select coalesce(name, 'anon') from users">, { coalesce: unknown }[]>
>;

type MultiArgumentCallAmongOtherColumns = Expect<
  Equal<Query<DB, 'select id, power(age, 2) from users'>, { id: number; power: number }[]>
>;

// An alias after the call is still an alias, with or without AS.
type MultiArgumentCallWithBareAlias = Expect<
  Equal<Query<DB, 'select power(age, 2) p from users'>, { p: number }[]>
>;

type MultiArgumentCallWithAsAlias = Expect<
  Equal<Query<DB, 'select power(age, 2) as p from users'>, { p: number }[]>
>;

// Controls: single-argument calls and plain bare aliases are unchanged.
type SingleArgumentCall = Expect<
  Equal<Query<DB, 'select lower(name) from users'>, { lower: string }[]>
>;

type CountStar = Expect<Equal<Query<DB, 'select count(*) from users'>, { count: number }[]>>;

type PlainBareAlias = Expect<
  Equal<Query<DB, 'select name handle from users'>, { handle: string }[]>
>;

export type MultiArgumentCallLock = [
  MultiArgumentCallKeepsItsName,
  MultiArgumentCallInStrictMode,
  CastCallKeepsItsName,
  ExtractCallKeepsItsName,
  CoalesceCallKeepsItsName,
  MultiArgumentCallAmongOtherColumns,
  MultiArgumentCallWithBareAlias,
  MultiArgumentCallWithAsAlias,
  SingleArgumentCall,
  CountStar,
  PlainBareAlias,
];
