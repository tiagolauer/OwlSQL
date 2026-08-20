import {
  createTypedDb,
  ResultStatus,
  QueryErrorKind,
  type Query,
  type Result,
  type QueryError,
} from '../src/index.js';

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2)
    ? true
    : false;

type Expect<T extends true> = T;

interface DB {
  users: {
    id: number;
    name: string;
    email: string;
    active: boolean;
  };
  posts: {
    id: number;
    title: string;
    user_id: number;
    published: boolean;
  };
}

type ProjectsListedColumns = Expect<
  Equal<Query<DB, 'select id, name from users'>, { id: number; name: string }[]>
>;

type ProjectsSingleColumn = Expect<
  Equal<Query<DB, 'select email from users'>, { email: string }[]>
>;

type PreservesColumnOrder = Expect<
  Equal<
    Query<DB, 'select name, id, active from users'>,
    { name: string; id: number; active: boolean }[]
  >
>;

type SelectStarReturnsWholeTable = Expect<
  Equal<
    Query<DB, 'select * from users'>,
    { id: number; name: string; email: string; active: boolean }[]
  >
>;

type ExplicitAliasRenamesColumn = Expect<
  Equal<
    Query<DB, 'select id, name as username from users'>,
    { id: number; username: string }[]
  >
>;

type ImplicitAliasRenamesColumn = Expect<
  Equal<Query<DB, 'select name handle from users'>, { handle: string }[]>
>;

type QualifiedColumnsResolve = Expect<
  Equal<
    Query<DB, 'select u.id, u.name from users u'>,
    { id: number; name: string }[]
  >
>;

type UppercaseKeywords = Expect<
  Equal<Query<DB, 'SELECT id, title FROM posts'>, { id: number; title: string }[]>
>;

type MixedCaseKeywords = Expect<
  Equal<Query<DB, 'Select id, title From posts'>, { id: number; title: string }[]>
>;

type MultilineWhitespaceTolerated = Expect<
  Equal<
    Query<
      DB,
      `
        select  id,
                title
        from    posts
      `
    >,
    { id: number; title: string }[]
  >
>;

type TrailingClausesIgnored = Expect<
  Equal<
    Query<DB, 'select id, title from posts where published = true order by id limit 10'>,
    { id: number; title: string }[]
  >
>;

type SecondTableResolves = Expect<
  Equal<
    Query<DB, 'select id, title, published from posts'>,
    { id: number; title: string; published: boolean }[]
  >
>;

declare const db: ReturnType<typeof createTypedDb<DB>>;

async function clientReturnTypeFlows() {
  const result = await db.query('select id, name from users');
  type RuntimeReturnsResult = Expect<
    Equal<
      typeof result,
      Result<{ id: number; name: string }[], QueryError>
    >
  >;

  if (result.status === ResultStatus.Error) {
    return result.error.kind satisfies QueryErrorKind;
  }

  return result.value satisfies { id: number; name: string }[];
}

export type Assertions = [
  ProjectsListedColumns,
  ProjectsSingleColumn,
  PreservesColumnOrder,
  SelectStarReturnsWholeTable,
  ExplicitAliasRenamesColumn,
  ImplicitAliasRenamesColumn,
  QualifiedColumnsResolve,
  UppercaseKeywords,
  MixedCaseKeywords,
  MultilineWhitespaceTolerated,
  TrailingClausesIgnored,
  SecondTableResolves,
  ReturnType<typeof clientReturnTypeFlows>,
];
