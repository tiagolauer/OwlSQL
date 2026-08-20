import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ConnectionPool, type config as MssqlConfig } from 'mssql';
import { createMssqlExecutor, createMssqlTransaction } from '../../src/adapters/mssql.js';
import { mssqlUrlToConfig } from '../../src/tooling/introspection/mssql.js';
import { isOk } from '../../src/index.js';
import { MSSQL_URL_ENV, metaOf, mssqlUrl, requireUrl, rowsOf } from './databases.js';

interface DB {
  it_mssql_rows: {
    id: number;
    name: string;
    total: string;
    price: number;
    active: boolean;
  };
}

describe.skipIf(mssqlUrl === undefined)('mssql adapter against a real SQL Server', () => {
  let pool: ConnectionPool;

  beforeAll(async () => {
    const config = mssqlUrlToConfig(requireUrl(mssqlUrl, MSSQL_URL_ENV)) as MssqlConfig;
    pool = new ConnectionPool(config);
    await pool.connect();
    await pool.request().query(`
      if object_id('it_mssql_rows', 'U') is not null drop table it_mssql_rows
    `);
    await pool.request().query(`
      create table it_mssql_rows (
        id int identity(1, 1) primary key,
        name nvarchar(64) not null,
        total bigint not null,
        price decimal(10, 2) not null,
        active bit not null
      )
    `);
    await pool
      .request()
      .query(`insert into it_mssql_rows (name, total, price, active) values ('ada', 42, 19.90, 1)`);
  });

  afterAll(async () => {
    await pool
      .request()
      .query(`if object_id('it_mssql_rows', 'U') is not null drop table it_mssql_rows`);
    await pool.close();
  });

  it('decodes bigint as a string, bit as a boolean, and decimal as a number', async () => {
    const executor = createMssqlExecutor(pool);

    const result = await executor('select total, price, active from it_mssql_rows', []);

    expect(rowsOf(result)).toEqual([{ total: '42', price: 19.9, active: true }]);
  });

  it('binds named parameters to the slots they appear in', async () => {
    const executor = createMssqlExecutor(pool);

    const matching = await executor(
      'select name from it_mssql_rows where name = @name and total = @total',
      ['ada', 42],
    );
    const swapped = await executor(
      'select name from it_mssql_rows where name = @name and total = @total',
      ['ada', 41],
    );

    expect(rowsOf(matching)).toEqual([{ name: 'ada' }]);
    expect(rowsOf(swapped)).toEqual([]);
  });

  it('binds a repeated named parameter from a single value slot', async () => {
    const executor = createMssqlExecutor(pool);

    const result = await executor('select @word as first, @word as second', ['owl']);

    expect(rowsOf(result)).toEqual([{ first: 'owl', second: 'owl' }]);
  });

  it('sends an undefined parameter as null', async () => {
    const executor = createMssqlExecutor(pool);

    const result = await executor(
      'select name from it_mssql_rows where @missing is null and name = @name',
      [undefined, 'ada'],
    );

    expect(rowsOf(result)).toEqual([{ name: 'ada' }]);
  });

  it('reports rowsAffected for an insert, an update, and a delete', async () => {
    const executor = createMssqlExecutor(pool);

    const inserted = await executor(
      `insert into it_mssql_rows (name, total, price, active) values ('grace', 1, 1.00, 0)`,
      [],
    );
    const updated = await executor(
      `update it_mssql_rows set active = 1 where name = 'grace'`,
      [],
    );
    const deleted = await executor(`delete from it_mssql_rows where name = 'grace'`, []);

    expect(metaOf(inserted)).toEqual({ rowCount: 1 });
    expect(metaOf(updated)).toEqual({ rowCount: 1 });
    expect(metaOf(deleted)).toEqual({ rowCount: 1 });
  });

  it('commits writes made inside a transaction callback', async () => {
    const inserted = await createMssqlTransaction<DB>(pool)(async (tx) =>
      tx.query(
        'insert into it_mssql_rows (name, total, price, active) values (@name, @total, @price, @active)',
        'committed',
        '1',
        1,
        true,
      ),
    );

    expect(isOk(inserted)).toBe(true);
    const check = await pool
      .request()
      .query(`select name from it_mssql_rows where name = 'committed'`);
    expect(check.recordset).toEqual([{ name: 'committed' }]);
  });

  it('leaves no rows behind when the transaction callback throws', async () => {
    await expect(
      createMssqlTransaction<DB>(pool)(async (tx) => {
        await tx.query(
          'insert into it_mssql_rows (name, total, price, active) values (@name, @total, @price, @active)',
          'rolled-back',
          '1',
          1,
          true,
        );
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');

    const check = await pool
      .request()
      .query(`select name from it_mssql_rows where name = 'rolled-back'`);
    expect(check.recordset).toEqual([]);
  });
});
