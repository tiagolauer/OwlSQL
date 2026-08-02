import type { Query, QueryTypeError, StrictRow } from '../src/index.js';

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;

type Expect<T extends true> = T;

interface DB {
  users: { id: number; name: string };
  posts: { id: number; user_id: number; title: string };
}

// One cast used to poison the whole strict row: `:` is not an operator
// character and nothing stripped the suffix, so `id::text` was looked up as a
// column name (issue #277).
type AliasedCastInStrictMode = Expect<
  Equal<StrictRow<DB, 'select id::text as id_text from users'>, { id_text: unknown }>
>;

type BareCastInStrictMode = Expect<
  Equal<StrictRow<DB, 'select id::text from users'>, { 'id::text': unknown }>
>;

type QualifiedCastInStrictMode = Expect<
  Equal<StrictRow<DB, 'select u.id::text as id_text from users u'>, { id_text: unknown }>
>;

type CastBesideOrdinaryColumns = Expect<
  Equal<
    StrictRow<DB, 'select name, id::numeric as amount from users'>,
    { name: string; amount: unknown }
  >
>;

// The operand is still resolved, so a typo inside the cast is still caught.
type CastOperandIsStillChecked = Expect<
  Equal<StrictRow<DB, 'select naem::text as x from users'>, QueryTypeError<'unknown column: naem'>>
>;

type CastOperandAliasIsStillChecked = Expect<
  Equal<StrictRow<DB, 'select p.id::text as x from users u'>, QueryTypeError<'unknown alias: p'>>
>;

// Loose mode was already harmless and stays as it was.
type LooseCastIsUnchanged = Expect<
  Equal<Query<DB, 'select id::text from users'>, { 'id::text': unknown }[]>
>;

// Controls: a plain column and a cast written on a placeholder elsewhere.
type PlainColumnIsUnaffected = Expect<
  Equal<StrictRow<DB, 'select id from users'>, { id: number }>
>;

type CastOnAFunctionCall = Expect<
  Equal<StrictRow<DB, 'select count(*)::int as total from users'>, { total: unknown }>
>;

export type CastColumnsLock = [
  AliasedCastInStrictMode,
  BareCastInStrictMode,
  QualifiedCastInStrictMode,
  CastBesideOrdinaryColumns,
  CastOperandIsStillChecked,
  CastOperandAliasIsStillChecked,
  LooseCastIsUnchanged,
  PlainColumnIsUnaffected,
  CastOnAFunctionCall,
];
