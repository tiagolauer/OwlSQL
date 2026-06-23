import type { Query, StrictQuery, QueryTypeError } from '../src/index.js';

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2)
    ? true
    : false;

type Expect<T extends true> = T;

interface DB {
  users: { id: number; name: string; email: string };
  posts: { id: number; title: string; user_id: number; views: number };
  comments: { id: number; post_id: number; body: string };
}

type InnerJoinQualified = Expect<
  Equal<
    Query<DB, 'select u.id, u.name, p.title from users u join posts p on u.id = p.user_id'>,
    { id: number; name: string; title: string }[]
  >
>;

type LeftJoinMakesRightNullable = Expect<
  Equal<
    Query<DB, 'select u.name, p.title from users u left join posts p on u.id = p.user_id'>,
    { name: string; title: string | null }[]
  >
>;

type LeftOuterJoinMakesRightNullable = Expect<
  Equal<
    Query<
      DB,
      'select u.name, p.views from users u left outer join posts p on u.id = p.user_id'
    >,
    { name: string; views: number | null }[]
  >
>;

type BareColumnsResolveAcrossTables = Expect<
  Equal<
    Query<DB, 'select name, title from users join posts on users.id = posts.user_id'>,
    { name: string; title: string }[]
  >
>;

type ThreeWayJoin = Expect<
  Equal<
    Query<
      DB,
      'select u.name, p.title, c.body from users u join posts p on u.id = p.user_id join comments c on p.id = c.post_id'
    >,
    { name: string; title: string; body: string }[]
  >
>;

type LeftJoinStarNullsRightSide = Expect<
  Equal<
    Query<DB, 'select * from users u left join posts p on u.id = p.user_id'>,
    {
      id: number;
      name: string;
      email: string;
      title: string | null;
      user_id: number | null;
      views: number | null;
    }[]
  >
>;

type StrictUnknownAliasIsTypeError = Expect<
  Equal<
    StrictQuery<DB, 'select x.id from users u join posts p on u.id = p.user_id'>,
    QueryTypeError<'unknown alias: x'>[]
  >
>;

export type JoinLock = [
  InnerJoinQualified,
  LeftJoinMakesRightNullable,
  LeftOuterJoinMakesRightNullable,
  BareColumnsResolveAcrossTables,
  ThreeWayJoin,
  LeftJoinStarNullsRightSide,
  StrictUnknownAliasIsTypeError,
];
