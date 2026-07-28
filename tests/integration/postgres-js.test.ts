import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import postgres from 'postgres';
import {
  createPostgresJsExecutor,
  createPostgresJsTransaction,
} from '../../src/adapters/postgres.js';
import { isOk } from '../../src/index.js';
import { PG_URL_ENV, metaOf, pgUrl, requireUrl, rowsOf } from './databases.js';

interface DB {
  it_postgres_js_rows: {
    id: number;
    name: string;
    total: string;
    active: boolean;
  };
}

describe.skipIf(pgUrl === undefined)('postgres.js adapter against a real PostgreSQL server', () => {
  let sql: postgres.Sql;

  beforeAll(async () => {
    sql = postgres(requireUrl(pgUrl, PG_URL_ENV));
    await sql.unsafe('drop table if exists it_postgres_js_rows');
    await sql.unsafe(`
      create table it_postgres_js_rows (
        id serial primary key,
        name text not null,
        total bigint not null,
        active boolean not null
      )
    `);
    await sql.unsafe(`insert into it_postgres_js_rows (name, total, active) values ('ada', 42, true)`);
  });

  afterAll(async () => {
    await sql.unsafe('drop table if exists it_postgres_js_rows');
    await sql.end();
  });

  it('reads rows back through the executor', async () => {
    const executor = createPostgresJsExecutor(sql);

    const result = await executor('select name, total, active from it_postgres_js_rows', []);

    expect(rowsOf(result)).toEqual([{ name: 'ada', total: '42', active: true }]);
  });

  it('binds numbered parameters to the right slots', async () => {
    const executor = createPostgresJsExecutor(sql);

    const result = await executor('select $2::text as second, $1::text as first', ['a', 'b']);

    expect(rowsOf(result)).toEqual([{ second: 'b', first: 'a' }]);
  });

  it('sends an undefined parameter as null instead of throwing', async () => {
    const executor = createPostgresJsExecutor(sql);

    const result = await executor('select ($1::text is null) as was_null', [undefined]);

    expect(rowsOf(result)).toEqual([{ was_null: true }]);
  });

  it('reports rowCount for an insert and a delete', async () => {
    const executor = createPostgresJsExecutor(sql);

    const inserted = await executor(
      `insert into it_postgres_js_rows (name, total, active) values ('grace', 1, false)`,
      [],
    );
    const deleted = await executor(`delete from it_postgres_js_rows where name = 'grace'`, []);

    expect(metaOf(inserted)).toEqual({ rowCount: 1 });
    expect(metaOf(deleted)).toEqual({ rowCount: 1 });
  });

  it('commits writes made inside a transaction callback', async () => {
    const inserted = await createPostgresJsTransaction<DB>(sql)(async (tx) =>
      tx.query(
        'insert into it_postgres_js_rows (name, total, active) values ($1, $2, $3)',
        'committed',
        '1',
        true,
      ),
    );

    expect(isOk(inserted)).toBe(true);
    const rows = await sql.unsafe(
      `select name from it_postgres_js_rows where name = 'committed'`,
    );
    expect([...rows]).toEqual([{ name: 'committed' }]);
  });

  it('leaves no rows behind when the transaction callback throws', async () => {
    await expect(
      createPostgresJsTransaction<DB>(sql)(async (tx) => {
        await tx.query(
          'insert into it_postgres_js_rows (name, total, active) values ($1, $2, $3)',
          'rolled-back',
          '1',
          true,
        );
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');

    const rows = await sql.unsafe(
      `select name from it_postgres_js_rows where name = 'rolled-back'`,
    );
    expect([...rows]).toEqual([]);
  });
});
