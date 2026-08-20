import type { Params, Row, StrictRow } from '../src/index.js';

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;

type Expect<T extends true> = T;

interface DB {
  users: { id: number; name: string };
  orders: { id: number; user_id: number; total: number };
}

// Regression for #246: the alias of a write target was replaced by the table
// name, so every reference through it failed to resolve.
type UpdateAliasResolves = Expect<
  Equal<StrictRow<DB, 'update users u set name = $1 where u.id = $2 returning u.id'>, { id: number }>
>;

type UpdateAsAliasResolves = Expect<
  Equal<
    StrictRow<DB, 'update users as u set name = $1 where u.id = $2 returning u.name'>,
    { name: string }
  >
>;

type UpdateAliasTypesItsParams = Expect<
  Equal<Params<DB, 'update users as u set name = $1 where u.id = $2'>, [string, number]>
>;

type UpdateAliasLooseRow = Expect<
  Equal<Row<DB, 'update users u set name = $1 returning u.name'>, { name: string }>
>;

type DeleteAliasResolves = Expect<
  Equal<StrictRow<DB, 'delete from users as u where u.id = $1 returning u.id'>, { id: number }>
>;

type DeleteBareAliasResolves = Expect<
  Equal<StrictRow<DB, 'delete from users u where u.id = $1 returning u.id'>, { id: number }>
>;

type MergeAliasResolves = Expect<
  Equal<
    StrictRow<
      DB,
      'merge into users as target using orders o on o.user_id = target.id when matched then update set name = $1 output inserted.id, target.name'
    >,
    { id: number; name: string }
  >
>;

type InsertAliasResolves = Expect<
  Equal<
    StrictRow<DB, 'insert into users as u (id, name) values ($1, $2) returning u.id'>,
    { id: number }
  >
>;

// The table name keeps resolving whether or not an alias was written, and a
// target with no alias is unchanged.
type TableNameStillResolvesAlongsideTheAlias = Expect<
  Equal<
    StrictRow<DB, 'update users u set name = $1 where users.id = $2 returning users.name'>,
    { name: string }
  >
>;

type NoAliasIsUnchanged = Expect<
  Equal<StrictRow<DB, 'update users set name = $1 where id = $2 returning id'>, { id: number }>
>;

type NoAliasDeleteIsUnchanged = Expect<
  Equal<StrictRow<DB, 'delete from users where id = $1 returning name'>, { name: string }>
>;

type GluedColumnListIsNotAnAlias = Expect<
  Equal<StrictRow<DB, 'insert into users(id, name) values ($1, $2) returning id'>, { id: number }>
>;

type UpdateFromKeepsTheExtraSource = Expect<
  Equal<
    StrictRow<
      DB,
      'update users u set name = $1 from orders o where o.user_id = u.id returning u.id, o.total'
    >,
    { id: number; total: number }
  >
>;

export type Assertions = [
  UpdateAliasResolves,
  UpdateAsAliasResolves,
  UpdateAliasTypesItsParams,
  UpdateAliasLooseRow,
  DeleteAliasResolves,
  DeleteBareAliasResolves,
  MergeAliasResolves,
  InsertAliasResolves,
  TableNameStillResolvesAlongsideTheAlias,
  NoAliasIsUnchanged,
  NoAliasDeleteIsUnchanged,
  GluedColumnListIsNotAnAlias,
  UpdateFromKeepsTheExtraSource,
];
