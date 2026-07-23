import type { Executor, DialectExecutor } from '../src/index.js';
import type { Pool as PgPool, Client as PgClient, PoolClient as PgPoolClient } from 'pg';
import type { Pool as Mysql2Pool, Connection as Mysql2Connection } from 'mysql2/promise';
import type postgres from 'postgres';
import type { DatabaseSync } from 'node:sqlite';
import type { Kysely } from 'kysely';
import type { ConnectionPool, Transaction, Request as MssqlRequest } from 'mssql';
import { createPgExecutor } from '../src/adapters/pg.js';
import { createMysql2Executor } from '../src/adapters/mysql2.js';
import { createPostgresJsExecutor } from '../src/adapters/postgres.js';
import { createNodeSqliteExecutor } from '../src/adapters/node-sqlite.js';
import { createKyselyExecutor } from '../src/adapters/kysely.js';
import { createMssqlExecutor } from '../src/adapters/mssql.js';

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2)
    ? true
    : false;

type Expect<T extends true> = T;

type PgExecutorMatchesShape = Expect<
  Equal<ReturnType<typeof createPgExecutor>, DialectExecutor<'dollar'>>
>;

type Mysql2ExecutorMatchesShape = Expect<
  Equal<ReturnType<typeof createMysql2Executor>, DialectExecutor<'question'>>
>;

type PostgresJsExecutorMatchesShape = Expect<
  Equal<ReturnType<typeof createPostgresJsExecutor>, DialectExecutor<'dollar'>>
>;

type NodeSqliteExecutorMatchesShape = Expect<
  Equal<
    ReturnType<typeof createNodeSqliteExecutor>,
    DialectExecutor<'question' | 'at' | 'dollar'>
  >
>;

type KyselyExecutorMatchesShape = Expect<
  Equal<ReturnType<typeof createKyselyExecutor<{ users: { id: number } }>>, Executor>
>;

type MssqlExecutorMatchesShape = Expect<
  Equal<ReturnType<typeof createMssqlExecutor>, DialectExecutor<'at'>>
>;

export function adapterCallSites() {
  createPgExecutor({} as PgPool);
  createPgExecutor({} as PgClient);
  createPgExecutor({} as PgPoolClient);
  createMysql2Executor({} as Mysql2Pool);
  createMysql2Executor({} as Mysql2Connection);
  createPostgresJsExecutor({} as postgres.Sql);
  createNodeSqliteExecutor({} as DatabaseSync);
  createKyselyExecutor({} as Kysely<{ users: { id: number } }>);
  // A ConnectionPool, an open Transaction, or an already-bound Request must
  // all be accepted so a caller can route a query through an open
  // transaction instead of always implicitly starting a new one (#133).
  createMssqlExecutor({} as ConnectionPool);
  createMssqlExecutor({} as Transaction);
  createMssqlExecutor({} as MssqlRequest);
}

export type AdaptersLock = [
  PgExecutorMatchesShape,
  Mysql2ExecutorMatchesShape,
  PostgresJsExecutorMatchesShape,
  NodeSqliteExecutorMatchesShape,
  KyselyExecutorMatchesShape,
  MssqlExecutorMatchesShape,
];
