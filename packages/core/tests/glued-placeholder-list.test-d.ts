import type { Params } from '../src/index.js';

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;

type Expect<T extends true> = T;

interface DB {
  users: { id: number; name: string };
}

// A glued list is one token to a space-splitting scan, and one token cannot
// hand out two slots. It used to produce a single slot named `$1,$2`, so
// `db.query(sql, 1)` compiled and pg rejected it at bind time with "bind
// message supplies 1 parameters, but prepared statement requires 2" (#291).
type GluedNumberedList = Expect<
  Equal<Params<DB, 'select id from users where id in ($1,$2)'>, []>
>;

type GluedNamedList = Expect<
  Equal<Params<DB, 'select id from users where id in (@a,@b)'>, []>
>;

// The `?` spelling already behaved this way; it is what the glued form is
// documented to do.
type GluedQuestionList = Expect<
  Equal<Params<DB, 'select id from users where id in (?,?)'>, []>
>;

// Controls: written with the space the README asks for, both slots are typed.
type SpacedNumberedList = Expect<
  Equal<Params<DB, 'select id from users where id in ($1, $2)'>, [number, number]>
>;

type SpacedQuestionList = Expect<
  Equal<Params<DB, 'select id from users where id in (?, ?)'>, [number, number]>
>;

// A placeholder inside a call still gets its slot (#244), including the one
// whose argument list carries a comma written with a space.
type PlaceholderInsideCall = Expect<
  Equal<Params<DB, 'select id from users where id = coalesce($1, 0)'>, [number]>
>;

type ArrayComparison = Expect<
  Equal<Params<DB, 'select id from users where id = any($1)'>, [number[]]>
>;

type PlainPlaceholder = Expect<
  Equal<Params<DB, 'select id from users where id = $1'>, [number]>
>;

export type GluedPlaceholderListLock = [
  GluedNumberedList,
  GluedNamedList,
  GluedQuestionList,
  SpacedNumberedList,
  SpacedQuestionList,
  PlaceholderInsideCall,
  ArrayComparison,
  PlainPlaceholder,
];
