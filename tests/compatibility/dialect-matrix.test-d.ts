import type { Query, Params } from '../../packages/core/src/index.js';
import type { MssqlCapabilities } from '../../packages/core/src/language/dialect/mssql.js';
import type { MysqlCapabilities } from '../../packages/core/src/language/dialect/mysql.js';
import type { PostgresCapabilities } from '../../packages/core/src/language/dialect/postgres.js';
import type { SqliteCapabilities } from '../../packages/core/src/language/dialect/sqlite.js';

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends
  (<T>() => T extends B ? 1 : 2) ? true : false;

type Expect<T extends true> = T;

interface DB {
  users: { id: number; name: string };
}

type SharedSelect = Expect<
  Equal<Query<DB, 'select id, name from users'>, { id: number; name: string }[]>
>;

type PostgresSyntax = Expect<
  Equal<
    Query<DB, 'insert into users (name) values ($1) returning id'>,
    { id: number }[]
  >
>;

type MysqlSyntax = Expect<
  Equal<Params<DB, 'select `id` from `users` where `id` = ?'>, [number]>
>;

type SqliteSyntax = Expect<
  Equal<Query<DB, 'insert into users (name) values (?) returning id'>, { id: number }[]>
>;

type MssqlSyntax = Expect<
  Equal<
    Query<DB, 'insert into users (name) output inserted.id values (@name)'>,
    { id: number }[]
  >
>;

type CapabilityLock = [
  Expect<Equal<PostgresCapabilities['top'], false>>,
  Expect<Equal<PostgresCapabilities['distinctOn'], true>>,
  Expect<Equal<PostgresCapabilities['returning'], true>>,
  Expect<Equal<PostgresCapabilities['output'], false>>,
  Expect<Equal<MysqlCapabilities['returning'], false>>,
  Expect<Equal<MysqlCapabilities['output'], false>>,
  Expect<Equal<SqliteCapabilities['returning'], true>>,
  Expect<Equal<SqliteCapabilities['top'], false>>,
  Expect<Equal<MssqlCapabilities['top'], true>>,
  Expect<Equal<MssqlCapabilities['returning'], false>>,
  Expect<Equal<MssqlCapabilities['output'], true>>,
];

export type DialectMatrixLock = [
  SharedSelect,
  PostgresSyntax,
  MysqlSyntax,
  SqliteSyntax,
  MssqlSyntax,
  CapabilityLock,
];
