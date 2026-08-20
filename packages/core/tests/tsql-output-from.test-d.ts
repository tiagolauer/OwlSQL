import type { Row, StrictRow } from '../src/index.js';

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;

type Expect<T extends true> = T;

interface DB {
  users: { id: number; name: string };
  audit: { id: number; user_id: number; note: string };
}

// `where` was the only boundary of the OUTPUT list, so the FROM clause was
// accumulated into it and `inserted.id from users` parsed as a single entry
// with `from users` as its alias (issue #300).
type UpdateOutputBeforeFrom = Expect<
  Equal<
    Row<DB, 'update users set name = @p1 output inserted.id from audit where id = @p2'>,
    { id: number }
  >
>;

type UpdateOutputWithSeveralColumns = Expect<
  Equal<
    Row<DB, 'update users set name = @p1 output inserted.id, inserted.name from audit where id = @p2'>,
    { id: number; name: string }
  >
>;

type DeleteOutputBeforeFrom = Expect<
  Equal<
    Row<DB, 'delete from users output deleted.id from audit where id = @p1'>,
    { id: number }
  >
>;

// `inserted.` is stripped before resolution, so the OUTPUT column is looked
// up against both sources - `name` is the one only `users` has - and the
// WHERE has to qualify `id`, which both of them carry.
type UpdateOutputBeforeFromInStrictMode = Expect<
  Equal<
    StrictRow<DB, 'update users set name = @p1 output inserted.name from audit where users.id = @p2'>,
    { name: string }
  >
>;

// Controls: the forms that already worked.
type UpdateOutputWithoutFrom = Expect<
  Equal<Row<DB, 'update users set name = @p1 output inserted.id where id = @p2'>, { id: number }>
>;

type UpdateOutputAsTheLastClause = Expect<
  Equal<Row<DB, 'update users set name = @p1 output inserted.id'>, { id: number }>
>;

type UpdateReturningIsUnaffected = Expect<
  Equal<Row<DB, 'update users set name = $1 where id = $2 returning id, name'>, { id: number; name: string }>
>;

export type TsqlOutputFromLock = [
  UpdateOutputBeforeFrom,
  UpdateOutputWithSeveralColumns,
  DeleteOutputBeforeFrom,
  UpdateOutputBeforeFromInStrictMode,
  UpdateOutputWithoutFrom,
  UpdateOutputAsTheLastClause,
  UpdateReturningIsUnaffected,
];
