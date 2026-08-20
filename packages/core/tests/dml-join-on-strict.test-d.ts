import type { QueryTypeError, Row, StrictRow } from '../src/index.js';

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;

type Expect<T extends true> = T;

interface DB {
  users: { id: number; name: string };
  orders: { id: number; user_id: number; total: number };
  refunds: { id: number; order_id: number };
}

type EmptyRow = Record<string, never>;

// The joined sources were registered - returning `r.id` worked - but the ON
// expressions were never seen, because both write branches passed an empty
// FROM text to the check (issue #281). The README says strict mode checks
// JOIN ... ON conditions and carves out nothing for writes.
type UpdateFromJoinOnIsChecked = Expect<
  Equal<
    StrictRow<
      DB,
      'update users set name = $1 from orders o join refunds r on r.nope = o.id where users.id = o.user_id'
    >,
    QueryTypeError<'unknown column: nope'>
  >
>;

type DeleteUsingJoinOnIsChecked = Expect<
  Equal<
    StrictRow<
      DB,
      'delete from users using orders o join refunds r on r.nope = o.id where users.id = o.user_id'
    >,
    QueryTypeError<'unknown column: nope'>
  >
>;

type UpdateFromJoinOnUnknownAliasIsChecked = Expect<
  Equal<
    StrictRow<
      DB,
      'update users set name = $1 from orders o join refunds r on q.order_id = o.id where users.id = o.user_id'
    >,
    QueryTypeError<'unknown alias: q'>
  >
>;

// Controls: the valid versions of the same statements still pass.
type ValidUpdateFromJoinOn = Expect<
  Equal<
    StrictRow<
      DB,
      'update users set name = $1 from orders o join refunds r on r.order_id = o.id where users.id = o.user_id'
    >,
    EmptyRow
  >
>;

type ValidDeleteUsingJoinOn = Expect<
  Equal<
    StrictRow<
      DB,
      'delete from users using orders o join refunds r on r.order_id = o.id where users.id = o.user_id'
    >,
    EmptyRow
  >
>;

type UpdateWithoutFromIsUnaffected = Expect<
  Equal<StrictRow<DB, 'update users set name = $1 where id = 1'>, EmptyRow>
>;

type UpdateFromWithReturningIsUnaffected = Expect<
  Equal<
    StrictRow<
      DB,
      'update users set name = $1 from orders o where users.id = o.user_id returning users.id'
    >,
    { id: number }
  >
>;

type LooseModeIsUnchanged = Expect<
  Equal<
    Row<
      DB,
      'update users set name = $1 from orders o join refunds r on r.nope = o.id where users.id = o.user_id'
    >,
    EmptyRow
  >
>;

export type DmlJoinOnStrictLock = [
  UpdateFromJoinOnIsChecked,
  DeleteUsingJoinOnIsChecked,
  UpdateFromJoinOnUnknownAliasIsChecked,
  ValidUpdateFromJoinOn,
  ValidDeleteUsingJoinOn,
  UpdateWithoutFromIsUnaffected,
  UpdateFromWithReturningIsUnaffected,
  LooseModeIsUnchanged,
];
