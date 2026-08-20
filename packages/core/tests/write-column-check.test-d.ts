import type { QueryTypeError, Row, StrictRow } from '../src/index.js';

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;

type Expect<T extends true> = T;

interface DB {
  users: { id: number; name: string; email: string };
  orders: { id: number; user_id: number; total: number };
}

type EmptyRow = Record<string, never>;

// Both are guaranteed runtime errors on every engine, and nothing scanned
// either list against the schema (issue #282).
type UnknownInsertColumn = Expect<
  Equal<
    StrictRow<DB, 'insert into users (naem) values ($1)'>,
    QueryTypeError<'unknown column: naem'>
  >
>;

type UnknownUpdateSetTarget = Expect<
  Equal<
    StrictRow<DB, 'update users set naem = $1 where id = 1'>,
    QueryTypeError<'unknown column: naem'>
  >
>;

type UnknownColumnLaterInTheInsertList = Expect<
  Equal<
    StrictRow<DB, 'insert into users (id, name, naem) values ($1, $2, $3)'>,
    QueryTypeError<'unknown column: naem'>
  >
>;

type UnknownTargetLaterInTheSetList = Expect<
  Equal<
    StrictRow<DB, 'update users set name = $1, naem = $2 where id = 1'>,
    QueryTypeError<'unknown column: naem'>
  >
>;

type UnknownInsertColumnWithReturning = Expect<
  Equal<
    StrictRow<DB, 'insert into users (naem) values ($1) returning id'>,
    QueryTypeError<'unknown column: naem'>
  >
>;

// Controls: valid writes still project what they always did.
type ValidInsertColumns = Expect<
  Equal<StrictRow<DB, 'insert into users (id, name) values ($1, $2)'>, EmptyRow>
>;

type ValidInsertWithReturning = Expect<
  Equal<StrictRow<DB, 'insert into users (id, name) values ($1, $2) returning id'>, { id: number }>
>;

type ValidUpdateTargets = Expect<
  Equal<StrictRow<DB, 'update users set name = $1, email = $2 where id = 1'>, EmptyRow>
>;

type InsertWithoutAColumnListIsUnchecked = Expect<
  Equal<StrictRow<DB, 'insert into users values ($1, $2, $3)'>, EmptyRow>
>;

type SetValueSubqueryIsNotATarget = Expect<
  Equal<
    StrictRow<DB, 'update users set name = (select name from users where id = 1) where id = 2'>,
    EmptyRow
  >
>;

type QualifiedSetTargetResolves = Expect<
  Equal<StrictRow<DB, 'update users set users.name = $1 where id = 1'>, EmptyRow>
>;

type LooseModeIsUnchanged = Expect<
  Equal<Row<DB, 'insert into users (naem) values ($1)'>, EmptyRow>
>;

export type WriteColumnCheckLock = [
  UnknownInsertColumn,
  UnknownUpdateSetTarget,
  UnknownColumnLaterInTheInsertList,
  UnknownTargetLaterInTheSetList,
  UnknownInsertColumnWithReturning,
  ValidInsertColumns,
  ValidInsertWithReturning,
  ValidUpdateTargets,
  InsertWithoutAColumnListIsUnchecked,
  SetValueSubqueryIsNotATarget,
  QualifiedSetTargetResolves,
  LooseModeIsUnchanged,
];
