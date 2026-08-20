import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPool, type Pool } from 'mysql2/promise';
import { createMysql2Executor, createMysql2Transaction } from '../../packages/core/src/adapters/mysql2.js';
import { isOk } from '../../packages/core/src/index.js';
import { MYSQL_URL_ENV, metaOf, mysqlUrl, requireUrl, rowsOf } from './databases.js';

interface DB {
  it_mysql_rows: {
    id: number;
    name: string;
    flag: number | null;
    bits: Buffer | null;
    total: number | null;
    price: string | null;
    payload: unknown;
  };
}

function firstRow(rows: unknown[]): Record<string, unknown> {
  return rows[0] as Record<string, unknown>;
}

describe.skipIf(mysqlUrl === undefined)('mysql2 adapter against a real MySQL server', () => {
  let pool: Pool;

  beforeAll(async () => {
    pool = createPool(requireUrl(mysqlUrl, MYSQL_URL_ENV));
    await pool.query('drop table if exists it_mysql_rows');
    await pool.query(`
      create table it_mysql_rows (
        id int auto_increment primary key,
        name varchar(64) not null,
        flag tinyint(1),
        bits bit(1),
        total bigint,
        price decimal(10, 2),
        payload json
      )
    `);
    await pool.query(
      `insert into it_mysql_rows (name, flag, bits, total, price, payload)
       values ('ada', 1, b'1', 42, 19.90, '{"tier":"gold"}')`,
    );
  });

  afterAll(async () => {
    await pool.query('drop table if exists it_mysql_rows');
    await pool.end();
  });

  it('decodes tinyint(1) as a number, not a boolean', async () => {
    const executor = createMysql2Executor(pool);

    const result = await executor('select flag from it_mysql_rows where name = ?', ['ada']);

    expect(firstRow(rowsOf(result)).flag).toBe(1);
  });

  it('decodes bit(1) as a Buffer', async () => {
    const executor = createMysql2Executor(pool);

    const result = await executor('select bits from it_mysql_rows where name = ?', ['ada']);

    expect(Buffer.isBuffer(firstRow(rowsOf(result)).bits)).toBe(true);
  });

  it('decodes bigint as a number and decimal as a string, matching the generated schema', async () => {
    const executor = createMysql2Executor(pool);

    const result = await executor('select total, price from it_mysql_rows where name = ?', ['ada']);

    expect(rowsOf(result)).toEqual([{ total: 42, price: '19.90' }]);
  });

  it('decodes json into a parsed value', async () => {
    const executor = createMysql2Executor(pool);

    const result = await executor('select payload from it_mysql_rows where name = ?', ['ada']);

    expect(firstRow(rowsOf(result)).payload).toEqual({ tier: 'gold' });
  });

  it('binds question-mark parameters in order', async () => {
    const executor = createMysql2Executor(pool);

    const matching = await executor('select name from it_mysql_rows where name = ? and total = ?', [
      'ada',
      42,
    ]);
    const swapped = await executor('select name from it_mysql_rows where name = ? and total = ?', [
      'ada',
      41,
    ]);

    expect(rowsOf(matching)).toEqual([{ name: 'ada' }]);
    expect(rowsOf(swapped)).toEqual([]);
  });

  it('sends an undefined parameter as null instead of throwing', async () => {
    const executor = createMysql2Executor(pool);

    const result = await executor('select (? is null) as was_null', [undefined]);

    expect(firstRow(rowsOf(result)).was_null).toBe(1);
  });

  it('reports affectedRows and insertId for an insert', async () => {
    const executor = createMysql2Executor(pool);

    const inserted = await executor('insert into it_mysql_rows (name) values (?)', ['grace']);
    const meta = metaOf(inserted);

    expect(meta.rowCount).toBe(1);
    expect(typeof meta.lastInsertRowid).toBe('number');

    const deleted = await executor('delete from it_mysql_rows where name = ?', ['grace']);
    expect(metaOf(deleted).rowCount).toBe(1);
  });

  it('commits writes made inside a transaction callback', async () => {
    const inserted = await createMysql2Transaction<DB>(pool)(async (tx) =>
      tx.query('insert into it_mysql_rows (name) values (?)', 'committed'),
    );

    expect(isOk(inserted)).toBe(true);
    const [rows] = await pool.query('select name from it_mysql_rows where name = ?', ['committed']);
    expect(rows).toEqual([{ name: 'committed' }]);
  });

  it('leaves no rows behind when the transaction callback throws', async () => {
    await expect(
      createMysql2Transaction<DB>(pool)(async (tx) => {
        await tx.query('insert into it_mysql_rows (name) values (?)', 'rolled-back');
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');

    const [rows] = await pool.query('select name from it_mysql_rows where name = ?', [
      'rolled-back',
    ]);
    expect(rows).toEqual([]);
  });
});
