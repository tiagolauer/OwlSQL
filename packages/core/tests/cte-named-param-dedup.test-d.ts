import type { Params } from '../src/index.js';

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;

type Expect<T extends true> = T;

interface DB {
  users: { id: number; name: string };
  orders: { id: number; user_id: number; total: number; region: string; created_at: string };
}

// The adapters dedupe by name across the whole statement, so a name written in
// a CTE body and again outside it binds once. The type layer scanned the two
// halves with separate registries and demanded a value for each occurrence, so
// every parameter after the duplicate shifted by one at runtime (issue #268).
type NamedRepeatedAcrossCteAndOuter = Expect<
  Equal<
    Params<DB, 'with t as (select id from users where id = @id) select id from t where id = @id'>,
    [number]
  >
>;

type ColonRepeatedAcrossCteAndOuter = Expect<
  Equal<
    Params<DB, 'with t as (select id from users where id = :id) select id from t where id = :id'>,
    [number]
  >
>;

// The runtime-corruption shape from the issue: the third value used to be
// dropped and @region received @since's value. @region types as unknown
// because the outer FROM is the CTE, which projects only id - that part is
// unchanged, what matters here is that there are two slots and not three.
type DuplicateDoesNotShiftTheParametersAfterIt = Expect<
  Equal<
    Params<
      DB,
      'with recent as (select id from orders where created_at > @since) select id from recent where total > @since and region = @region'
    >,
    [string, unknown]
  >
>;

type NamedRepeatedAcrossTwoCteBodies = Expect<
  Equal<
    Params<
      DB,
      'with a as (select id from users where id = @id), b as (select id from orders where user_id = @id) select id from b'
    >,
    [number]
  >
>;

// Controls: distinct names still get a slot each, in textual order with the
// CTE body first.
type DistinctNamesKeepTheirSlots = Expect<
  Equal<
    Params<
      DB,
      'with t as (select id from users where name = @name) select id from t where id = @id'
    >,
    [string, number]
  >
>;

type NumberedAcrossTheBoundaryIsUnchanged = Expect<
  Equal<
    Params<DB, 'with t as (select id from users where id = $1) select id from t where id = $1'>,
    [number]
  >
>;

type NumberedDistinctAcrossTheBoundary = Expect<
  Equal<
    Params<DB, 'with t as (select id from users where id = $1) select id from t where id = $2'>,
    [number, number]
  >
>;

type QuestionIsNeverDeduped = Expect<
  Equal<
    Params<DB, 'with t as (select id from users where id = ?) select id from t where id = ?'>,
    [number, number]
  >
>;

export type CteNamedParamDedupLock = [
  NamedRepeatedAcrossCteAndOuter,
  ColonRepeatedAcrossCteAndOuter,
  DuplicateDoesNotShiftTheParametersAfterIt,
  NamedRepeatedAcrossTwoCteBodies,
  DistinctNamesKeepTheirSlots,
  NumberedAcrossTheBoundaryIsUnchanged,
  NumberedDistinctAcrossTheBoundary,
  QuestionIsNeverDeduped,
];
