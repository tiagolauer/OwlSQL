import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Pool } from 'pg';
import { createPool, type Pool as MysqlPool } from 'mysql2/promise';
import { ConnectionPool, type config as MssqlConfig } from 'mssql';
import { generateSchema } from '../../src/tooling/schema-generator/generate.js';
import { mssqlUrlToConfig } from '../../src/tooling/introspection/mssql.js';
import {
  MSSQL_URL_ENV,
  MYSQL_URL_ENV,
  PG_URL_ENV,
  mssqlUrl,
  mysqlUrl,
  pgUrl,
  requireUrl,
} from './databases.js';

function makeOutputPath(): { dir: string; file: string } {
  const dir = mkdtempSync(join(tmpdir(), 'owlsql-generate-'));
  return { dir, file: join(dir, 'schema.ts') };
}

describe.skipIf(pgUrl === undefined)('owlsql generate against a real PostgreSQL server', () => {
  const output = makeOutputPath();
  let pool: Pool;

  beforeAll(async () => {
    pool = new Pool({ connectionString: requireUrl(pgUrl, PG_URL_ENV) });
    await pool.query('drop table if exists it_gen_pg');
    await pool.query('drop type if exists it_gen_mood');
    await pool.query(`create type it_gen_mood as enum ('happy', 'sad')`);
    await pool.query(`
      create table it_gen_pg (
        id serial primary key,
        name text not null,
        bio text,
        total bigint not null,
        price numeric(10, 2) not null,
        tags text[] not null,
        mood it_gen_mood not null,
        created_at timestamptz not null
      )
    `);
  });

  afterAll(async () => {
    await pool.query('drop table if exists it_gen_pg');
    await pool.query('drop type if exists it_gen_mood');
    await pool.end();
    rmSync(output.dir, { recursive: true, force: true });
  });

  it('introspects columns, nullability, enums, and arrays into a schema file', async () => {
    const result = await generateSchema({
      url: requireUrl(pgUrl, PG_URL_ENV),
      out: output.file,
      tables: ['it_gen_pg'],
    });

    expect(result).toEqual({ kind: 'written' });
    expect(await readFile(output.file, 'utf8')).toBe(
      'export interface DB {\n' +
        '  it_gen_pg: {\n' +
        '    id: number;\n' +
        '    name: string;\n' +
        '    bio: string | null;\n' +
        '    total: string;\n' +
        '    price: string;\n' +
        '    tags: string[];\n' +
        '    mood: "happy" | "sad";\n' +
        '    created_at: Date;\n' +
        '  };\n' +
        '}\n',
    );
  });

  it('reports an up-to-date file as unchanged and a stale one as drifted', async () => {
    const options = {
      url: requireUrl(pgUrl, PG_URL_ENV),
      out: output.file,
      tables: ['it_gen_pg'],
      check: true,
    };

    expect(await generateSchema(options)).toEqual({ kind: 'upToDate' });

    await pool.query('alter table it_gen_pg add column extra text');
    const drifted = await generateSchema(options);

    expect(drifted.kind).toBe('drift');
  });
});

describe.skipIf(mysqlUrl === undefined)('owlsql generate against a real MySQL server', () => {
  const output = makeOutputPath();
  let pool: MysqlPool;

  beforeAll(async () => {
    pool = createPool(requireUrl(mysqlUrl, MYSQL_URL_ENV));
    await pool.query('drop table if exists it_gen_mysql');
    await pool.query(`
      create table it_gen_mysql (
        id int auto_increment primary key,
        name varchar(64) not null,
        bio text,
        flag tinyint(1) not null,
        bits bit(1) not null,
        total bigint not null,
        price decimal(10, 2) not null,
        created_at datetime not null
      )
    `);
  });

  afterAll(async () => {
    await pool.query('drop table if exists it_gen_mysql');
    await pool.end();
    rmSync(output.dir, { recursive: true, force: true });
  });

  it('maps tinyint(1) and bit(1) to what mysql2 actually returns', async () => {
    const result = await generateSchema({
      url: requireUrl(mysqlUrl, MYSQL_URL_ENV),
      out: output.file,
      tables: ['it_gen_mysql'],
    });

    expect(result).toEqual({ kind: 'written' });
    expect(await readFile(output.file, 'utf8')).toBe(
      'export interface DB {\n' +
        '  it_gen_mysql: {\n' +
        '    id: number;\n' +
        '    name: string;\n' +
        '    bio: string | null;\n' +
        '    flag: number;\n' +
        '    bits: Buffer;\n' +
        '    total: number;\n' +
        '    price: string;\n' +
        '    created_at: Date;\n' +
        '  };\n' +
        '}\n',
    );
  });
});

describe.skipIf(mssqlUrl === undefined)('owlsql generate against a real SQL Server', () => {
  const output = makeOutputPath();
  let pool: ConnectionPool;

  beforeAll(async () => {
    const config = mssqlUrlToConfig(requireUrl(mssqlUrl, MSSQL_URL_ENV)) as MssqlConfig;
    pool = new ConnectionPool(config);
    await pool.connect();
    await pool
      .request()
      .query(`if object_id('it_gen_mssql', 'U') is not null drop table it_gen_mssql`);
    await pool.request().query(`
      create table it_gen_mssql (
        id int identity(1, 1) primary key,
        name nvarchar(64) not null,
        bio nvarchar(max) null,
        total bigint not null,
        price decimal(10, 2) not null,
        active bit not null,
        created_at datetime2 not null
      )
    `);
  });

  afterAll(async () => {
    await pool
      .request()
      .query(`if object_id('it_gen_mssql', 'U') is not null drop table it_gen_mssql`);
    await pool.close();
    rmSync(output.dir, { recursive: true, force: true });
  });

  it('introspects sys.tables into a schema file', async () => {
    const result = await generateSchema({
      url: requireUrl(mssqlUrl, MSSQL_URL_ENV),
      out: output.file,
      tables: ['it_gen_mssql'],
    });

    expect(result).toEqual({ kind: 'written' });
    expect(await readFile(output.file, 'utf8')).toBe(
      'export interface DB {\n' +
        '  it_gen_mssql: {\n' +
        '    id: number;\n' +
        '    name: string;\n' +
        '    bio: string | null;\n' +
        '    total: string;\n' +
        '    price: number;\n' +
        '    active: boolean;\n' +
        '    created_at: Date;\n' +
        '  };\n' +
        '}\n',
    );
  });
});
