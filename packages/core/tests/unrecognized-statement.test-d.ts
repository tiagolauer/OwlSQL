import type { Query, QueryTypeError, Row, StrictQuery, StrictRow } from '../src/index.js';

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;

type Expect<T extends true> = T;

interface DB {
  users: { id: number; name: string };
}

type Unrecognized = QueryTypeError<'unsupported or unrecognized statement'>;

// Failing loudly is right; the message is what was missing. `never` says
// nothing, and the message this produced before the #275 guard landed named no
// table at all: `unknown table: ''` (issue #303).
type UnsupportedStatementIsNamed = Expect<
  Equal<StrictRow<DB, 'truncate users'>, Unrecognized>
>;

// A keyword typo is a keyword typo, not a table problem.
type KeywordTypoIsNamed = Expect<Equal<StrictRow<DB, 'selct id from users'>, Unrecognized>>;

type EmptyQueryIsNamed = Expect<Equal<StrictRow<DB, ''>, Unrecognized>>;

type StrictQueryReportsItToo = Expect<
  Equal<StrictQuery<DB, 'truncate users'>, Unrecognized[]>
>;

// Loose mode keeps failing quietly rather than degrading into an index
// signature, which is what the #275 guard put in place.
type LooseModeIsUnchanged = Expect<Equal<Row<DB, 'truncate users'>, never>>;

// Controls: recognized statements are untouched, and the other statement-level
// error still reads the way it did.
type SelectIsUnaffected = Expect<Equal<StrictRow<DB, 'select id from users'>, { id: number }>>;

type UpdateIsUnaffected = Expect<
  Equal<StrictRow<DB, 'update users set name = $1 where id = $2 returning id'>, { id: number }>
>;

type StackedStatementsStillReportThemselves = Expect<
  Equal<
    StrictQuery<DB, 'select id from users; drop table users'>,
    QueryTypeError<'multiple statements are not supported: found a semicolon before the end of the query'>[]
  >
>;

type LooseSelectIsUnaffected = Expect<
  Equal<Query<DB, 'select id from users'>, { id: number }[]>
>;

export type UnrecognizedStatementLock = [
  UnsupportedStatementIsNamed,
  KeywordTypoIsNamed,
  EmptyQueryIsNamed,
  StrictQueryReportsItToo,
  LooseModeIsUnchanged,
  SelectIsUnaffected,
  UpdateIsUnaffected,
  StackedStatementsStillReportThemselves,
  LooseSelectIsUnaffected,
];
