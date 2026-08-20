import type { Params, QueryTypeError } from '../src/index.js';

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;

type Expect<T extends true> = T;

interface DB {
  users: { id: number; name: string; email: string | null };
  posts: { id: number; user_id: number; title: string };
}

// Reusing one placeholder against columns of different types has to be
// rejected - pg refuses inconsistent deduced parameter types too - but the
// bare `never` the intersection produced made every call fail, including the
// zero-argument one, with nothing pointing at the cause (issue #302).
type ConflictingNumberedPlaceholder = Expect<
  Equal<
    Params<DB, 'select id from users where id = $1 or name = $1'>,
    [QueryTypeError<'conflicting types for $1'>]
  >
>;

type ConflictingNamedPlaceholder = Expect<
  Equal<
    Params<DB, 'select id from users where id = @v or name = @v'>,
    [QueryTypeError<'conflicting types for @v'>]
  >
>;

type ConflictingColonPlaceholder = Expect<
  Equal<
    Params<DB, 'select id from users where id = :v or name = :v'>,
    [QueryTypeError<'conflicting types for :v'>]
  >
>;

// The conflicting slot does not swallow the ones beside it.
type ConflictKeepsTheOtherSlots = Expect<
  Equal<
    Params<DB, 'select id from users where id = $1 or name = $1 and email = $2'>,
    [QueryTypeError<'conflicting types for $1'>, string]
  >
>;

// Controls: repeating a placeholder against the same type is the documented
// behaviour and still collapses to one slot.
type RepeatedPlaceholderSameType = Expect<
  Equal<Params<DB, 'select id from users where id = $1 or id = $1'>, [number]>
>;

type RepeatedNamedSameType = Expect<
  Equal<Params<DB, 'select id from users where id = @id or id = @id'>, [number]>
>;

type RepeatedAcrossTablesSameType = Expect<
  Equal<
    Params<
      DB,
      'select u.id from users u join posts p on u.id = p.user_id where u.id = $1 or p.user_id = $1'
    >,
    [number]
  >
>;

type DistinctPlaceholdersAreUnaffected = Expect<
  Equal<Params<DB, 'select id from users where id = $1 or name = $2'>, [number, string]>
>;

export type ConflictingParamsLock = [
  ConflictingNumberedPlaceholder,
  ConflictingNamedPlaceholder,
  ConflictingColonPlaceholder,
  ConflictKeepsTheOtherSlots,
  RepeatedPlaceholderSameType,
  RepeatedNamedSameType,
  RepeatedAcrossTablesSameType,
  DistinctPlaceholdersAreUnaffected,
];
