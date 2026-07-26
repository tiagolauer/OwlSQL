import type { Query, StrictRow, StrictQuery, QueryTypeError } from '../src/index.js';

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2)
    ? true
    : false;

type Expect<T extends true> = T;

interface DB {
  users: { id: number; name: string; created_at: string };
  orders: { id: number; user_id: number; total: number };
  refunds: { id: number; order_id: number };
}

type UnknownColumnInOnIsCaught = Expect<
  Equal<
    StrictQuery<DB, 'select u.id from users u join orders o on u.id = o.nope'>,
    QueryTypeError<'unknown column: nope'>[]
  >
>;

type UnknownAliasInOnIsCaught = Expect<
  Equal<
    StrictQuery<DB, 'select u.id from users u join orders o on u.id = z.user_id'>,
    QueryTypeError<'unknown alias: z'>[]
  >
>;

type ValidOnStillResolves = Expect<
  Equal<StrictRow<DB, 'select u.id from users u join orders o on u.id = o.user_id'>, { id: number }>
>;

type TypoInTheSecondJoinIsCaught = Expect<
  Equal<
    StrictQuery<
      DB,
      'select u.id from users u join orders o on u.id = o.user_id join refunds r on r.nope = o.id'
    >,
    QueryTypeError<'unknown column: nope'>[]
  >
>;

type ValidTwoJoinChainResolves = Expect<
  Equal<
    StrictRow<
      DB,
      'select u.id from users u join orders o on u.id = o.user_id join refunds r on r.order_id = o.id'
    >,
    { id: number }
  >
>;

type LeftJoinOnIsValidatedToo = Expect<
  Equal<
    StrictQuery<DB, 'select u.id from users u left join orders o on u.id = o.nope'>,
    QueryTypeError<'unknown column: nope'>[]
  >
>;

type CompoundOnConditionIsValidated = Expect<
  Equal<
    StrictQuery<DB, 'select u.id from users u join orders o on u.id = o.user_id and o.nope = 1'>,
    QueryTypeError<'unknown column: nope'>[]
  >
>;

type ValidCompoundOnResolves = Expect<
  Equal<
    StrictRow<DB, 'select u.id from users u join orders o on u.id = o.user_id and o.total > 10'>,
    { id: number }
  >
>;

type OnAgainstADerivedTableResolves = Expect<
  Equal<
    StrictRow<
      DB,
      'select u.id from users u join (select user_id from orders) o on o.user_id = u.id'
    >,
    { id: number }
  >
>;

type CrossJoinWithoutOnStillResolves = Expect<
  Equal<StrictRow<DB, 'select u.id from users u cross join orders o'>, { id: number }>
>;

type OnPlaceholderIsNotValidated = Expect<
  Equal<
    StrictRow<DB, 'select u.id from users u join orders o on o.user_id = $1'>,
    { id: number }
  >
>;

type WhereClauseStillCaughtAlongsideAValidOn = Expect<
  Equal<
    StrictQuery<
      DB,
      'select u.id from users u join orders o on u.id = o.user_id where u.naem = 1'
    >,
    QueryTypeError<'unknown column: naem'>[]
  >
>;

type NonStrictModeStillIgnoresTheOnClause = Expect<
  Equal<Query<DB, 'select u.id from users u join orders o on u.id = o.nope'>, { id: number }[]>
>;

// GROUP BY / HAVING / ORDER BY keep their own resolution rules (SELECT-list
// aliases, ordinals, aggregates) and stay out of scope - locked in here so
// the boundary the README documents is a tested one.
type OrderByIsNotValidated = Expect<
  Equal<StrictRow<DB, 'select id from users where id = 1 order by nope'>, { id: number }>
>;

type GroupByIsNotValidated = Expect<
  Equal<StrictRow<DB, 'select id from users group by nope'>, { id: number }>
>;

type HavingIsNotValidated = Expect<
  Equal<StrictRow<DB, 'select id from users where id = 1 having nope > 1'>, { id: number }>
>;

export type Assertions = [
  UnknownColumnInOnIsCaught,
  UnknownAliasInOnIsCaught,
  ValidOnStillResolves,
  TypoInTheSecondJoinIsCaught,
  ValidTwoJoinChainResolves,
  LeftJoinOnIsValidatedToo,
  CompoundOnConditionIsValidated,
  ValidCompoundOnResolves,
  OnAgainstADerivedTableResolves,
  CrossJoinWithoutOnStillResolves,
  OnPlaceholderIsNotValidated,
  WhereClauseStillCaughtAlongsideAValidOn,
  NonStrictModeStillIgnoresTheOnClause,
  OrderByIsNotValidated,
  GroupByIsNotValidated,
  HavingIsNotValidated,
];
