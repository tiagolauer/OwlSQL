import type { Query, QueryTypeError, StrictRow } from '../src/index.js';

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;

type Expect<T extends true> = T;

interface DB {
  users: { id: number; name: string };
  posts: { id: number; user_id: number; title: string };
}

// Wrapping a column in parentheses is valid everywhere, and something people
// do while editing an expression. It used to resolve as a call to a function
// named `''`, so the column came back unknown - in strict mode too, after the
// column had already been validated on the way there (issue #288).
type ParenthesizedColumnWithAlias = Expect<
  Equal<Query<DB, 'select (id) as x from users'>, { x: number }[]>
>;

type ParenthesizedColumnInStrictMode = Expect<
  Equal<StrictRow<DB, 'select (id) as x from users'>, { x: number }>
>;

type ParenthesizedQualifiedColumn = Expect<
  Equal<Query<DB, 'select (u.name) as handle from users u'>, { handle: string }[]>
>;

type ParenthesizedColumnAmongOthers = Expect<
  Equal<Query<DB, 'select id, (name) as handle from users'>, { id: number; handle: string }[]>
>;

// An unknown column inside the parentheses is still an unknown column.
type ParenthesizedTypoStillErrors = Expect<
  Equal<StrictRow<DB, 'select (naem) as x from users'>, QueryTypeError<'unknown column: naem'>>
>;

// Controls: a real function call is still a call, and a group holding more
// than a name is left alone.
type FunctionCallIsUnaffected = Expect<
  Equal<Query<DB, 'select count(*) as total from users'>, { total: number }[]>
>;

type LowerCallIsUnaffected = Expect<
  Equal<Query<DB, 'select lower(name) as handle from users'>, { handle: string }[]>
>;

type ScalarSubqueryIsUnaffected = Expect<
  Equal<
    Query<DB, 'select (select count(*) from posts) as total from users'>,
    { total: number }[]
  >
>;

export type ParenthesizedColumnLock = [
  ParenthesizedColumnWithAlias,
  ParenthesizedColumnInStrictMode,
  ParenthesizedQualifiedColumn,
  ParenthesizedColumnAmongOthers,
  ParenthesizedTypoStillErrors,
  FunctionCallIsUnaffected,
  LowerCallIsUnaffected,
  ScalarSubqueryIsUnaffected,
];
