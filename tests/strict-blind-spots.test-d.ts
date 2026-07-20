import type { Query, StrictRow, StrictQuery, QueryTypeError } from '../src/index.js';

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2)
    ? true
    : false;

type Expect<T extends true> = T;

interface DB {
  users: { id: number; name: string };
  posts: { id: number; user_id: number; title: string };
}

type TypoInsideFunctionArgIsCaught = Expect<
  Equal<
    StrictQuery<DB, 'select max(naem) as m from users'>,
    QueryTypeError<'unknown column: naem'>[]
  >
>;

type ValidFunctionArgResolves = Expect<
  Equal<StrictRow<DB, 'select max(name) as m from users'>, { m: number }>
>;

type NestedFunctionArgIsCaught = Expect<
  Equal<
    StrictQuery<DB, 'select coalesce(lower(naem)) as m from users'>,
    QueryTypeError<'unknown column: naem'>[]
  >
>;

type CountStarStillResolves = Expect<
  Equal<StrictRow<DB, 'select count(*) as total from users'>, { total: number }>
>;

type CountDistinctColumnValidated = Expect<
  Equal<
    StrictQuery<DB, 'select count(distinct naem) as total from users'>,
    QueryTypeError<'unknown column: naem'>[]
  >
>;

type LiteralFunctionArgSkipsValidation = Expect<
  Equal<StrictRow<DB, "select coalesce(name, 'anon') as n from users">, { n: unknown }>
>;

type UnknownAliasStarIsCaught = Expect<
  Equal<
    StrictQuery<DB, 'select x.* from users u'>,
    QueryTypeError<'unknown alias: x'>[]
  >
>;

type KnownAliasStarStillResolves = Expect<
  Equal<StrictRow<DB, 'select u.* from users u'>, { id: number; name: string }>
>;

type AmbiguousBareColumnIsCaught = Expect<
  Equal<
    StrictQuery<DB, 'select id from users u join posts p on u.id = p.user_id'>,
    QueryTypeError<'ambiguous column: id'>[]
  >
>;

type UnambiguousBareColumnAcrossJoinResolves = Expect<
  Equal<
    StrictRow<DB, 'select title from users u join posts p on u.id = p.user_id'>,
    { title: string }
  >
>;

type LooseAmbiguityKeepsFirstMatch = Expect<
  Equal<
    Query<DB, 'select id from users u join posts p on u.id = p.user_id'>,
    { id: number }[]
  >
>;

export type Assertions = [
  TypoInsideFunctionArgIsCaught,
  ValidFunctionArgResolves,
  NestedFunctionArgIsCaught,
  CountStarStillResolves,
  CountDistinctColumnValidated,
  LiteralFunctionArgSkipsValidation,
  UnknownAliasStarIsCaught,
  KnownAliasStarStillResolves,
  AmbiguousBareColumnIsCaught,
  UnambiguousBareColumnAcrossJoinResolves,
  LooseAmbiguityKeepsFirstMatch,
];
