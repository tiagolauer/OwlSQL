import type { Query, StrictRow, Params } from '../src/index.js';

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
    note: string;
  };
}

type UnbalancedParenInsideLiteral = Expect<
  Equal<
    Query<DB, "select coalesce(name, ':(') as n, id from users">,
    { n: unknown; id: number }[]
  >
>;

type CommaInsideLiteral = Expect<
  Equal<
    Query<DB, "select 'a, b' as label, id from users">,
    { label: unknown; id: number }[]
  >
>;

type EscapedQuoteInsideLiteral = Expect<
  Equal<
    Query<DB, "select 'it''s, fine' as label, id from users">,
    { label: unknown; id: number }[]
  >
>;

type DollarInsideLiteralIsNotPlaceholder = Expect<
  Equal<Params<DB, "select id from users where note = 'costs $5 today'">, []>
>;

type QuestionMarkInsideLiteralIsNotPlaceholder = Expect<
  Equal<Params<DB, "select id from users where note = 'why?'">, []>
>;

type AtInsideCteLiteralKeepsParamTyping = Expect<
  Equal<
    Params<
      DB,
      "with t as (select id from users where email like '%@%') select id from t where id = $1"
    >,
    [number]
  >
>;

type SemicolonInsideLiteralDoesNotSplit = Expect<
  Equal<
    Query<DB, "select id from users where note = 'a;b'">,
    { id: number }[]
  >
>;

type KeywordInsideLiteralIgnored = Expect<
  Equal<
    Query<DB, "select id, 'from users where' as fragment from users">,
    { id: number; fragment: unknown }[]
  >
>;

type StrictStillResolvesRealColumns = Expect<
  Equal<
    StrictRow<DB, "select id from users where note = 'x, (y'">,
    { id: number }
  >
>;

export type Assertions = [
  UnbalancedParenInsideLiteral,
  CommaInsideLiteral,
  EscapedQuoteInsideLiteral,
  DollarInsideLiteralIsNotPlaceholder,
  QuestionMarkInsideLiteralIsNotPlaceholder,
  AtInsideCteLiteralKeepsParamTyping,
  SemicolonInsideLiteralDoesNotSplit,
  KeywordInsideLiteralIgnored,
  StrictStillResolvesRealColumns,
];
