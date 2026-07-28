import type { Params, Executor } from '../src/index.js';
import { createTypedDb } from '../src/index.js';

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2)
    ? true
    : false;

type Expect<T extends true> = T;

interface DB {
  users: { id: number; name: string; active: boolean };
}

type ParenthesizedWhereGroupResolvesColumns = Expect<
  Equal<
    Params<DB, 'select id from users where (id = $1 or name = $2)'>,
    [number, string]
  >
>;

type NestedParenGroupsResolveColumns = Expect<
  Equal<
    Params<DB, 'select id from users where ((id = $1) and (name = $2))'>,
    [number, string]
  >
>;

type OnConflictUpdatePlaceholderTyped = Expect<
  Equal<
    Params<
      DB,
      'insert into users (name) values ($1) on conflict (name) do update set name = $2'
    >,
    [string, string]
  >
>;

type MultiRowValuesAllTyped = Expect<
  Equal<
    Params<DB, 'insert into users (id, name) values ($1, $2), ($3, $4)'>,
    [number, string, number, string]
  >
>;

type MultiRowValuesOutOfOrderBindByIndex = Expect<
  Equal<
    Params<DB, 'insert into users (id, name) values ($3, $4), ($1, $2)'>,
    [number, string, number, string]
  >
>;

type MultiRowSequentialPlaceholders = Expect<
  Equal<
    Params<DB, 'insert into users (id, name) values (?, ?), (?, ?)'>,
    [number, string, number, string]
  >
>;

type SingleGroupControlUnchanged = Expect<
  Equal<Params<DB, 'insert into users (name) values ($1) returning id'>, [string]>
>;

type MixedLiteralAndPlaceholderRows = Expect<
  Equal<
    Params<DB, "insert into users (id, name) values (1, $1), (2, $2)">,
    [string, string]
  >
>;

// Regression for #230: an INSERT with no VALUES clause has to reach the
// documented unknown[] fallback. It used to collapse to `never`, which is a
// rest parameter no call - not even the zero-argument one - can satisfy.
type InsertSelectFallsBackToUnknownParams = Expect<
  Equal<Params<DB, 'insert into users (id, name) select id, name from users'>, unknown[]>
>;

type InsertSelectWithPlaceholderFallsBackToUnknownParams = Expect<
  Equal<
    Params<DB, 'insert into users (id, name) select id, name from users where id = $1'>,
    unknown[]
  >
>;

declare const executor: Executor;

// The tuple assertions above are only half the story: `never` also has to stop
// reaching the call site, where it rejected even the zero-argument call.
export async function insertSelectIsCallable() {
  return createTypedDb<DB>(executor).query('insert into users (id, name) select id, name from users');
}

export type Assertions = [
  InsertSelectFallsBackToUnknownParams,
  InsertSelectWithPlaceholderFallsBackToUnknownParams,
  ParenthesizedWhereGroupResolvesColumns,
  NestedParenGroupsResolveColumns,
  OnConflictUpdatePlaceholderTyped,
  MultiRowValuesAllTyped,
  MultiRowValuesOutOfOrderBindByIndex,
  MultiRowSequentialPlaceholders,
  SingleGroupControlUnchanged,
  MixedLiteralAndPlaceholderRows,
];
