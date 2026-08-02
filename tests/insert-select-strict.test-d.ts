import type { QueryTypeError, Row, StrictRow } from '../src/index.js';

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;

type Expect<T extends true> = T;

interface DB {
  users: { id: number; name: string };
  archive: { id: number; name: string; archived_at: string };
}

type EmptyRow = Record<string, never>;

// The INSERT branch read the target and the RETURNING clause and stopped, so
// the trailing SELECT was never parsed as a statement - its sources, columns
// and WHERE did not exist as far as validation was concerned (issue #272).
type UnknownSourceTableInTheSelectHalf = Expect<
  Equal<
    StrictRow<DB, 'insert into users (name) select naem from ghosts where nope = 1'>,
    QueryTypeError<'unknown table: ghosts'>
  >
>;

type UnknownColumnInTheSelectHalf = Expect<
  Equal<
    StrictRow<DB, 'insert into users (name) select naem from archive'>,
    QueryTypeError<'unknown column: naem'>
  >
>;

type UnknownColumnInTheSelectHalfWhere = Expect<
  Equal<
    StrictRow<DB, 'insert into users (name) select name from archive where nope = 1'>,
    QueryTypeError<'unknown column: nope'>
  >
>;

// Controls: a valid INSERT ... SELECT still projects what it always did.
type ValidInsertSelect = Expect<
  Equal<StrictRow<DB, 'insert into users (name) select name from archive'>, EmptyRow>
>;

type ValidInsertSelectWithWhere = Expect<
  Equal<
    StrictRow<DB, 'insert into users (name) select name from archive where id = 1'>,
    EmptyRow
  >
>;

type ValidInsertSelectWithReturning = Expect<
  Equal<
    StrictRow<DB, 'insert into users (id, name) select id, name from archive returning id'>,
    { id: number }
  >
>;

type InsertValuesIsUnaffected = Expect<
  Equal<StrictRow<DB, 'insert into users (name) values ($1)'>, EmptyRow>
>;

type PlainSelectIsUnaffected = Expect<
  Equal<StrictRow<DB, 'select name from archive'>, { name: string }>
>;

type LooseModeIsUnchanged = Expect<
  Equal<Row<DB, 'insert into users (name) select naem from ghosts'>, EmptyRow>
>;

export type InsertSelectStrictLock = [
  UnknownSourceTableInTheSelectHalf,
  UnknownColumnInTheSelectHalf,
  UnknownColumnInTheSelectHalfWhere,
  ValidInsertSelect,
  ValidInsertSelectWithWhere,
  ValidInsertSelectWithReturning,
  InsertValuesIsUnaffected,
  PlainSelectIsUnaffected,
  LooseModeIsUnchanged,
];
