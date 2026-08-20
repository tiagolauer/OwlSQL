import type { Params } from '../src/index.js';

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;

type Expect<T extends true> = T;

interface DB {
  users: { id: number; name: string; email: string | null };
  posts: { id: number; user_id: number; title: string; views: number | null };
}

// `= NULL` never matches a row, so accepting null here typed a query that
// silently returns nothing (issue #299).
type ComparisonAgainstNullableColumn = Expect<
  Equal<Params<DB, 'select id from users where email = $1'>, [string]>
>;

type LikeAgainstNullableColumn = Expect<
  Equal<Params<DB, 'select id from users where email like $1'>, [string]>
>;

// Join-induced nullability is the clearest case: the `| null` belongs to the
// result side, since a missing match makes the column null in the output.
type ComparisonAgainstJoinNullableColumn = Expect<
  Equal<
    Params<
      DB,
      'select u.id from users u left join posts p on u.id = p.user_id where p.views = $1'
    >,
    [number]
  >
>;

type InListAgainstNullableColumn = Expect<
  Equal<Params<DB, 'select id from posts where views in $1'>, [number]>
>;

// `is distinct from` exists to compare against null, so it keeps it.
type IsDistinctFromKeepsNull = Expect<
  Equal<Params<DB, 'select id from users where email is distinct from $1'>, [string | null]>
>;

// Writes are not comparisons: storing null in a nullable column is ordinary.
type UpdateSetKeepsNull = Expect<
  Equal<Params<DB, 'update users set email = $1 where id = $2'>, [string | null, number]>
>;

type UpdateSetKeepsNullForEveryAssignment = Expect<
  Equal<
    Params<DB, 'update posts set title = $1, views = $2 where id = $3'>,
    [string, number | null, number]
  >
>;

type InsertValuesKeepsNull = Expect<
  Equal<Params<DB, 'insert into users (name, email) values ($1, $2)'>, [string, string | null]>
>;

// Controls: a non-nullable column is unchanged, and an array-wrapping call
// still wraps the element type.
type NonNullableColumnIsUnchanged = Expect<
  Equal<Params<DB, 'select id from users where name = $1'>, [string]>
>;

type AnyArrayStillWraps = Expect<
  Equal<Params<DB, 'select id from users where id = any($1)'>, [number[]]>
>;

type LimitIsStillNumber = Expect<Equal<Params<DB, 'select id from users limit $1'>, [number]>>;

export type NullableParamsLock = [
  ComparisonAgainstNullableColumn,
  LikeAgainstNullableColumn,
  ComparisonAgainstJoinNullableColumn,
  InListAgainstNullableColumn,
  IsDistinctFromKeepsNull,
  UpdateSetKeepsNull,
  UpdateSetKeepsNullForEveryAssignment,
  InsertValuesKeepsNull,
  NonNullableColumnIsUnchanged,
  AnyArrayStillWraps,
  LimitIsStillNumber,
];
