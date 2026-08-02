import type { Query, QueryTypeError, StrictQuery } from '../src/index.js';

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;

type Expect<T extends true> = T;

interface DB {
  a: { id: number; x: string };
  b: { id: number; y: string };
  c: { id: number; z: string };
}

// USING merges the join column in every dialect that has it, and referencing
// it bare is the whole point of the syntax - it was reported as ambiguous
// because the count that decides ambiguity sees one source per table (#284).
type MergedColumnResolves = Expect<
  Equal<StrictQuery<DB, 'select id from a join b using (id)'>, { id: number }[]>
>;

type MergedColumnBesideOthers = Expect<
  Equal<
    StrictQuery<DB, 'select id, x, y from a join b using (id)'>,
    { id: number; x: string; y: string }[]
  >
>;

type MergedColumnAcrossTwoJoins = Expect<
  Equal<StrictQuery<DB, 'select id from a join b using (id) join c using (id)'>, { id: number }[]>
>;

type LeftJoinUsingResolves = Expect<
  Equal<StrictQuery<DB, 'select id from a left join b using (id)'>, { id: number }[]>
>;

// The joined table keeps its own name as its alias: it used to be set to the
// literal word `using`.
type QualifiedReferenceThroughAUsingJoin = Expect<
  Equal<StrictQuery<DB, 'select b.y from a join b using (id)'>, { y: string }[]>
>;

// Controls: a genuine ambiguity is still reported, a column outside the USING
// list is still ambiguous, and ON joins are untouched.
type OnJoinStillReportsAmbiguity = Expect<
  Equal<
    StrictQuery<DB, 'select id from a join b on a.id = b.id'>,
    QueryTypeError<'ambiguous column: id'>[]
  >
>;

type NonMergedColumnStillAmbiguous = Expect<
  Equal<
    StrictQuery<DB, 'select id from a join b using (x)'>,
    QueryTypeError<'ambiguous column: id'>[]
  >
>;

type LooseModeIsUnchanged = Expect<
  Equal<Query<DB, 'select id from a join b using (id)'>, { id: number }[]>
>;

type UnknownColumnStillReported = Expect<
  Equal<
    StrictQuery<DB, 'select nope from a join b using (id)'>,
    QueryTypeError<'unknown column: nope'>[]
  >
>;

export type JoinUsingMergedLock = [
  MergedColumnResolves,
  MergedColumnBesideOthers,
  MergedColumnAcrossTwoJoins,
  LeftJoinUsingResolves,
  QualifiedReferenceThroughAUsingJoin,
  OnJoinStillReportsAmbiguity,
  NonMergedColumnStillAmbiguous,
  LooseModeIsUnchanged,
  UnknownColumnStillReported,
];
