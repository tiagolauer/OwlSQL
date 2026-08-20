import type { Query, Row, StrictRow, Params, QueryTypeError } from '../src/index.js';

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;

type Expect<T extends true> = T;

interface DB {
  users: {
    id: number;
    name: string;
    amount: number;
  };
  orders: {
    id: number;
    user_id: number;
  };
}

interface Spaced {
  reports: {
    'first name': string;
    id: number;
  };
}

type TabAndNewline = Expect<Equal<Query<DB, 'select\tid\nfrom users'>, { id: number }[]>>;

type Crlf = Expect<Equal<Query<DB, 'select id\r\nfrom users'>, { id: number }[]>>;

type TabIndentedBlock = Expect<
  Equal<Query<DB, 'select\tid,\n\tname\nfrom users'>, { id: number; name: string }[]>
>;

type CrlfThroughout = Expect<
  Equal<
    Row<DB, 'select id,\r\n\tname\r\nfrom users\r\nwhere id = 1'>,
    { id: number; name: string }
  >
>;

type EveryWhitespaceKind = Expect<
  Equal<Query<DB, 'select\f\vid\t\r\nfrom\tusers'>, { id: number }[]>
>;

type CrlfKeepsStrictChecking = Expect<
  Equal<StrictRow<DB, 'select naem\r\nfrom users'>, QueryTypeError<'unknown column: naem'>>
>;

type CrlfKeepsParamInference = Expect<
  Equal<Params<DB, 'select id\r\nfrom users\r\nwhere amount = $1'>, [number]>
>;

type CrlfAcrossJoin = Expect<
  Equal<
    Row<DB, 'select u.id,\r\n\to.id as order_id\r\nfrom users u\r\njoin orders o on o.user_id = u.id'>,
    { id: number; order_id: number }
  >
>;

type QuotedSpaceSurvivesCrlf = Expect<
  Equal<Query<Spaced, 'select "first name"\r\nfrom reports'>, { 'first name': string }[]>
>;

type PlainNewlineStillWorks = Expect<Equal<Query<DB, 'select id\nfrom users'>, { id: number }[]>>;

type RepeatedSpacesStillCollapse = Expect<
  Equal<Query<DB, 'select  id   from users'>, { id: number }[]>
>;

export type {
  TabAndNewline,
  Crlf,
  TabIndentedBlock,
  CrlfThroughout,
  EveryWhitespaceKind,
  CrlfKeepsStrictChecking,
  CrlfKeepsParamInference,
  CrlfAcrossJoin,
  QuotedSpaceSurvivesCrlf,
  PlainNewlineStillWorks,
  RepeatedSpacesStillCollapse,
};
