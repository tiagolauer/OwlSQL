import type { Params } from '../src/index.js';

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;

type Expect<T extends true> = T;

interface DB {
  users: { id: number; name: string };
}

// The README promises "a placeholder inside a call is typed", and it is in a
// WHERE clause. In INSERT VALUES the entry was one token and the call carried
// an inner comma, so the placeholder registered no slot at all: the caller
// could pass only one value, the runtime scanner bound it to the first name
// and the second to null, and the INSERT wrote into the wrong column (#269).
type QuestionInsideMultiArgumentCall = Expect<
  Equal<
    Params<DB, 'insert into users (id, name) values (coalesce(?, 0), ?)'>,
    [number, string]
  >
>;

type NamedInsideMultiArgumentCall = Expect<
  Equal<
    Params<DB, 'insert into users (id, name) values (coalesce(@a, 0), @b)'>,
    [number, string]
  >
>;

type NumberedInsideMultiArgumentCall = Expect<
  Equal<
    Params<DB, 'insert into users (id, name) values (coalesce($1, 0), $2)'>,
    [number, string]
  >
>;

type NestedCallAroundThePlaceholder = Expect<
  Equal<
    Params<DB, 'insert into users (id, name) values ($1, coalesce(lower(@b), $$x$$))'>,
    [number, string]
  >
>;

// Controls: the shapes that already worked.
type BarePlaceholders = Expect<
  Equal<Params<DB, 'insert into users (id, name) values ($1, $2)'>, [number, string]>
>;

type SingleArgumentCall = Expect<
  Equal<Params<DB, 'insert into users (id, name) values ($1, lower($2))'>, [number, string]>
>;

type LiteralsTakeNoSlot = Expect<
  Equal<Params<DB, 'insert into users (id, name) values (1, ?)'>, [string]>
>;

type PlaceholderInACallInWhere = Expect<
  Equal<Params<DB, 'select id from users where id = coalesce($1, 0)'>, [number]>
>;

export type InsertValuesCallParamsLock = [
  QuestionInsideMultiArgumentCall,
  NamedInsideMultiArgumentCall,
  NumberedInsideMultiArgumentCall,
  NestedCallAroundThePlaceholder,
  BarePlaceholders,
  SingleArgumentCall,
  LiteralsTakeNoSlot,
  PlaceholderInACallInWhere,
];
