import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Pool } from 'pg';
import { createPgExecutor, createPgTransaction } from '../../src/adapters/pg.js';
import { isOk } from '../../src/index.js';
import { PG_URL_ENV, metaOf, pgUrl, requireUrl, rowsOf } from './databases.js';

interface DB {
  it_pg_rows: {
    id: number;
    name: string;
    bio: string | null;
    total: string;
    price: string;
    active: boolean;
  };
}

describe.skipIf(pgUrl === undefined)('pg adapter against a real PostgreSQL server', () => {
  let pool: Pool;

  beforeAll(async () => {
    pool = new Pool({ connectionString: requireUrl(pgUrl, PG_URL_ENV) });
    await pool.query('drop table if exists it_pg_rows');
    await pool.query(`
      create table it_pg_rows (
        id serial primary key,
        name text not null,
        bio text,
        total bigint not null,
        price numeric(10, 2) not null,
        active boolean not null
      )
    `);
    await pool.query(
      `insert into it_pg_rows (name, bio, total, price, active)
       values ('ada', null, 9007199254740993, 19.90, true)`,
    );
  });

  afterAll(async () => {
    await pool.query('drop table if exists it_pg_rows');
    await pool.end();
  });

  it('reads rows back through the executor', async () => {
    const executor = createPgExecutor(pool);

    const result = await executor('select name, active from it_pg_rows', []);

    expect(rowsOf(result)).toEqual([{ name: 'ada', active: true }]);
  });

  it('decodes bigint and numeric columns as strings, matching the generated schema', async () => {
    const executor = createPgExecutor(pool);

    const result = await executor('select total, price from it_pg_rows', []);

    expect(rowsOf(result)).toEqual([{ total: '9007199254740993', price: '19.90' }]);
  });

  it('decodes count(*) as a string, matching the documented aggregate caveat', async () => {
    const executor = createPgExecutor(pool);

    const result = await executor('select count(*) as total from it_pg_rows', []);

    expect(rowsOf(result)).toEqual([{ total: '1' }]);
  });

  it('binds numbered parameters to the right slots', async () => {
    const executor = createPgExecutor(pool);

    const result = await executor('select $2::text as second, $1::text as first', ['a', 'b']);

    expect(rowsOf(result)).toEqual([{ second: 'b', first: 'a' }]);
  });

  it('sends an undefined parameter as null', async () => {
    const executor = createPgExecutor(pool);

    const result = await executor('select name from it_pg_rows where bio is not distinct from $1', [
      undefined,
    ]);

    expect(rowsOf(result)).toEqual([{ name: 'ada' }]);
  });

  it('reports rowCount for an insert, an update, and a delete', async () => {
    const executor = createPgExecutor(pool);

    const inserted = await executor(
      `insert into it_pg_rows (name, total, price, active) values ('grace', 1, 1.00, false)`,
      [],
    );
    const updated = await executor(`update it_pg_rows set active = true where name = 'grace'`, []);
    const deleted = await executor(`delete from it_pg_rows where name = 'grace'`, []);

    expect(metaOf(inserted)).toEqual({ rowCount: 1 });
    expect(metaOf(updated)).toEqual({ rowCount: 1 });
    expect(metaOf(deleted)).toEqual({ rowCount: 1 });
  });

  it('commits writes made inside a transaction callback', async () => {
    const inserted = await createPgTransaction<DB>(pool)(async (tx) =>
      tx.query(
        'insert into it_pg_rows (name, total, price, active) values ($1, $2, $3, $4)',
        'committed',
        '1',
        '1.00',
        true,
      ),
    );

    expect(isOk(inserted)).toBe(true);
    const { rows } = await pool.query('select name from it_pg_rows where name = $1', ['committed']);
    expect(rows).toEqual([{ name: 'committed' }]);
  });

  it('leaves no rows behind when the transaction callback throws', async () => {
    await expect(
      createPgTransaction<DB>(pool)(async (tx) => {
        await tx.query(
          'insert into it_pg_rows (name, total, price, active) values ($1, $2, $3, $4)',
          'rolled-back',
          '1',
          '1.00',
          true,
        );
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');

    const { rows } = await pool.query('select name from it_pg_rows where name = $1', [
      'rolled-back',
    ]);
    expect(rows).toEqual([]);
  });
});
