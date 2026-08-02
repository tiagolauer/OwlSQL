import type { Query, StrictRow } from '../src/index.js';

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;

type Expect<T extends true> = T;

interface DB {
  users: {
    id: number;
    'a--b': string;
    "it's": string;
    'a/*b': string;
    'a$b': string;
  };
  'weird-table': { id: number };
}

// Comment stripping and literal masking ran before anything knew about double
// quotes, so the `--` inside a quoted name ate the rest of the query and the
// `'` opened a literal mask (issue #287). Quoted identifiers are the
// documented escape hatch for exactly these names.
type DashDashInsideAQuotedName = Expect<
  Equal<Query<DB, 'select "a--b" from users'>, { 'a--b': string }[]>
>;

type DashDashInsideAQuotedNameInStrictMode = Expect<
  Equal<StrictRow<DB, 'select "a--b" from users'>, { 'a--b': string }>
>;

type ApostropheInsideAQuotedName = Expect<
  Equal<Query<DB, `select "it's" from users`>, { "it's": string }[]>
>;

type BlockCommentOpenerInsideAQuotedName = Expect<
  Equal<Query<DB, 'select "a/*b" from users'>, { 'a/*b': string }[]>
>;

type DollarInsideAQuotedName = Expect<
  Equal<Query<DB, 'select "a$b" from users'>, { 'a$b': string }[]>
>;

type QuotedNameAmongOtherColumns = Expect<
  Equal<Query<DB, 'select id, "a--b" from users'>, { id: number; 'a--b': string }[]>
>;

// A real comment and a real literal still do their job when a quoted
// identifier is in the same query.
type RealCommentStillStripped = Expect<
  Equal<Query<DB, 'select "a--b" from users -- trailing note'>, { 'a--b': string }[]>
>;

type RealLiteralStillMasked = Expect<
  Equal<Query<DB, `select "a--b" from users where id = 'x'`>, { 'a--b': string }[]>
>;

// Controls: ordinary quoting, backticks and brackets are unchanged.
type PlainQuotedName = Expect<Equal<Query<DB, 'select "id" from users'>, { id: number }[]>>;

type BracketQuotedTable = Expect<
  Equal<Query<DB, 'select id from [weird-table]'>, { id: number }[]>
>;

type BacktickQuotedName = Expect<
  Equal<Query<DB, 'select `id` from users'>, { id: number }[]>
>;

export type QuotedIdentifierPunctuationLock = [
  DashDashInsideAQuotedName,
  DashDashInsideAQuotedNameInStrictMode,
  ApostropheInsideAQuotedName,
  BlockCommentOpenerInsideAQuotedName,
  DollarInsideAQuotedName,
  QuotedNameAmongOtherColumns,
  RealCommentStillStripped,
  RealLiteralStillMasked,
  PlainQuotedName,
  BracketQuotedTable,
  BacktickQuotedName,
];
