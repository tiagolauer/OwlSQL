import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Kysely, PostgresDialect } from 'kysely';
import { Pool } from 'pg';
import { createKyselyExecutor } from '../../src/adapters/kysely.js';
import { PG_URL_ENV, metaOf, pgUrl, requireUrl, rowsOf } from './databases.js';

interface KyselyDB {
  it_kysely_rows: { id: number; name: string };
}

describe.skipIf(pgUrl === undefined)('kysely adapter against a real PostgreSQL server', () => {
  let db: Kysely<KyselyDB>;

  beforeAll(async () => {
    db = new Kysely<KyselyDB>({
      dialect: new PostgresDialect({
        pool: new Pool({ connectionString: requireUrl(pgUrl, PG_URL_ENV) }),
      }),
    });
    const executor = createKyselyExecutor(db);
    await executor('drop table if exists it_kysely_rows', []);
    await executor(
      'create table it_kysely_rows (id serial primary key, name text not null)',
      [],
    );
  });

  afterAll(async () => {
    await createKyselyExecutor(db)('drop table if exists it_kysely_rows', []);
    await db.destroy();
  });

  it('runs a parameterized query through kysely and reads the rows back', async () => {
    const executor = createKyselyExecutor(db);

    await executor('insert into it_kysely_rows (name) values ($1)', ['ada']);
    const result = await executor('select name from it_kysely_rows where name = $1', ['ada']);

    expect(rowsOf(result)).toEqual([{ name: 'ada' }]);
  });

  it('reports the affected row count as a bigint', async () => {
    const executor = createKyselyExecutor(db);

    const inserted = await executor('insert into it_kysely_rows (name) values ($1)', ['grace']);

    expect(metaOf(inserted).rowCount).toBe(1n);
  });
});
