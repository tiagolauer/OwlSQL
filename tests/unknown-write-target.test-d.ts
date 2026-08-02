import type { QueryTypeError, Row, StrictQuery, StrictRow } from '../src/index.js';

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;

type Expect<T extends true> = T;

interface DB {
  users: { id: number; name: string };
  orders: { id: number; user_id: number; total: number };
}

type EmptyRow = Record<string, never>;

// Table existence was only ever verified as a side effect of resolving some
// column, in RETURNING or in WHERE - so a write with neither, which is the
// everyday INSERT, never checked its target at all (issue #271).
type UnknownInsertTarget = Expect<
  Equal<StrictRow<DB, 'insert into ghosts (name) values ($1)'>, QueryTypeError<'unknown table: ghosts'>>
>;

type UnknownDeleteTarget = Expect<
  Equal<StrictRow<DB, 'delete from ghosts'>, QueryTypeError<'unknown table: ghosts'>>
>;

type UnknownUpdateTarget = Expect<
  Equal<StrictRow<DB, 'update ghosts set name = $1'>, QueryTypeError<'unknown table: ghosts'>>
>;

type UnknownTargetThroughStrictQuery = Expect<
  Equal<StrictQuery<DB, 'insert into ghosts (name) values ($1)'>, QueryTypeError<'unknown table: ghosts'>[]>
>;

// The forms that already reported it keep reporting it.
type UnknownTargetWithReturning = Expect<
  Equal<StrictRow<DB, 'insert into ghosts (name) values ($1) returning id'>, QueryTypeError<'unknown table: ghosts'>>
>;

// Controls: a real target with no RETURNING and no WHERE still projects
// nothing, in every write shape.
type KnownInsertTarget = Expect<
  Equal<StrictRow<DB, 'insert into users (name) values ($1)'>, EmptyRow>
>;

type KnownDeleteTarget = Expect<Equal<StrictRow<DB, 'delete from users'>, EmptyRow>>;

type KnownUpdateTarget = Expect<
  Equal<StrictRow<DB, 'update users set name = $1'>, EmptyRow>
>;

type KnownUpdateWithFromClause = Expect<
  Equal<StrictRow<DB, 'update users set name = $1 from orders'>, EmptyRow>
>;

// Loose mode is unchanged: it does not report unknown tables.
type LooseModeIsUnchanged = Expect<
  Equal<Row<DB, 'insert into ghosts (name) values ($1)'>, EmptyRow>
>;

export type UnknownWriteTargetLock = [
  UnknownInsertTarget,
  UnknownDeleteTarget,
  UnknownUpdateTarget,
  UnknownTargetThroughStrictQuery,
  UnknownTargetWithReturning,
  KnownInsertTarget,
  KnownDeleteTarget,
  KnownUpdateTarget,
  KnownUpdateWithFromClause,
  LooseModeIsUnchanged,
];
