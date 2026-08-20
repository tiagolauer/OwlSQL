import { describe, it, expect } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { DatabaseSync } from 'node:sqlite';
import { introspectSqlite } from '../src/tooling/introspection/sqlite';
import { loadSqlite, sqliteAvailable } from './sqlite-availability.js';

function withTempDatabase(setup: (db: DatabaseSync) => void): string {
  const dir = mkdtempSync(join(tmpdir(), 'owlsql-'));
  const file = join(dir, 'test.db');
  const db = new (loadSqlite())(file);
  setup(db);
  db.close();
  return file;
}

describe.skipIf(!sqliteAvailable)('introspectSqlite', () => {
  it('introspects columns, types, and nullability from a real database file', async () => {
    const file = withTempDatabase((db) => {
      db.exec(`
        create table users (
          id integer primary key,
          name text not null,
          bio text,
          active boolean not null
        )
      `);
    });

    try {
      const tables = await introspectSqlite({ url: file });

      expect(tables).toHaveLength(1);
      expect(tables[0]?.name).toBe('users');
      expect(tables[0]?.columns).toEqual([
        { name: 'id', tsType: 'number', nullable: false },
        { name: 'name', tsType: 'string', nullable: false },
        { name: 'bio', tsType: 'string', nullable: true },
        { name: 'active', tsType: '0 | 1', nullable: false },
      ]);
    } finally {
      rmSync(join(file, '..'), { recursive: true, force: true });
    }
  });

  it('keeps composite and non-INTEGER primary keys nullable-aware', async () => {
    const file = withTempDatabase((db) => {
      db.exec('create table pairs (a integer, b integer, primary key (a, b))');
      db.exec('create table codes (code text primary key)');
    });

    try {
      const tables = await introspectSqlite({ url: file });
      const pairs = tables.find((table) => table.name === 'pairs');
      const codes = tables.find((table) => table.name === 'codes');

      expect(pairs?.columns.map((column) => column.nullable)).toEqual([true, true]);
      expect(codes?.columns[0]?.nullable).toBe(true);
    } finally {
      rmSync(join(file, '..'), { recursive: true, force: true });
    }
  });

  // Regression for #292: PRAGMA table_info omits generated columns, so the
  // schema disagreed with `select *`, which returns all four.
  it('includes VIRTUAL and STORED generated columns', async () => {
    const file = withTempDatabase((db) => {
      db.exec(`
        create table products (
          id integer primary key,
          price real not null,
          total_v real generated always as (price * 2) virtual,
          total_s real generated always as (price * 3) stored
        )
      `);
    });

    try {
      const tables = await introspectSqlite({ url: file });

      expect(tables[0]?.columns.map((column) => column.name)).toEqual([
        'id',
        'price',
        'total_v',
        'total_s',
      ]);
      expect(tables[0]?.columns.map((column) => column.tsType)).toEqual([
        'number',
        'number',
        'number',
        'number',
      ]);
    } finally {
      rmSync(join(file, '..'), { recursive: true, force: true });
    }
  });

  // table_xinfo also exposes a virtual table's own hidden columns (hidden = 1),
  // which `select *` does not return and the schema must not claim.
  it('leaves a virtual table hidden column out', async () => {
    const file = withTempDatabase((db) => {
      db.exec("create virtual table docs using fts5(title, body)");
    });

    try {
      const tables = await introspectSqlite({ url: file });
      const docs = tables.find((table) => table.name === 'docs');

      expect(docs?.columns.map((column) => column.name)).toEqual(['title', 'body']);
    } finally {
      rmSync(join(file, '..'), { recursive: true, force: true });
    }
  });

  it('introspects multiple tables', async () => {
    const file = withTempDatabase((db) => {
      db.exec('create table users (id integer primary key, name text not null)');
      db.exec('create table posts (id integer primary key, user_id integer not null, title text not null)');
    });

    try {
      const tables = await introspectSqlite({ url: file });

      expect(tables.map((table) => table.name).sort()).toEqual(['posts', 'users']);
    } finally {
      rmSync(join(file, '..'), { recursive: true, force: true });
    }
  });
});
