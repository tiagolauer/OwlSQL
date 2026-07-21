import { describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { detectDialect, runGenerate } from '../src/cli/generate.js';
import { loadSqlite, sqliteAvailable } from './sqlite-availability.js';
import { normalizeSqlitePath } from '../src/cli/dialects/sqlite.js';
import { formatCliError } from '../src/cli/index.js';

function createDatabase(): { dir: string; file: string } {
  const dir = mkdtempSync(join(tmpdir(), 'owlsql-'));
  const file = join(dir, 'app.db');
  const db = new (loadSqlite())(file);
  db.exec('create table users (id integer primary key, name text not null)');
  db.exec('create table posts (id integer primary key, title text not null)');
  db.close();
  return { dir, file };
}

describe('sqlite URL forms', () => {
  it('routes sqlite:// and file: URLs to the sqlite dialect', () => {
    expect(detectDialect('sqlite://./app.db')).toBe('sqlite');
    expect(detectDialect('sqlite:./app.db')).toBe('sqlite');
    expect(detectDialect('file:./app.db')).toBe('sqlite');
  });

  it('normalizes sqlite prefixes to plain paths', () => {
    expect(normalizeSqlitePath('sqlite://./app.db')).toBe('./app.db');
    expect(normalizeSqlitePath('sqlite:./app.db')).toBe('./app.db');
    expect(normalizeSqlitePath('file://./app.db')).toBe('./app.db');
    expect(normalizeSqlitePath('./app.db')).toBe('./app.db');
  });

  it.skipIf(!sqliteAvailable)('introspects through a sqlite:// URL', async () => {
    const { dir, file } = createDatabase();
    try {
      const out = join(dir, 'schema.ts');
      await runGenerate({ url: `sqlite://${file}`, out });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe.skipIf(!sqliteAvailable)('table filtering', () => {
  it('honors --table include lists', async () => {
    const { dir, file } = createDatabase();
    try {
      const out = join(dir, 'schema.ts');
      await runGenerate({ url: file, out, tables: ['users'] });
      const { readFileSync } = await import('node:fs');
      const written = readFileSync(out, 'utf8');
      expect(written).toContain('users');
      expect(written).not.toContain('posts');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('honors --exclude lists', async () => {
    const { dir, file } = createDatabase();
    try {
      const out = join(dir, 'schema.ts');
      await runGenerate({ url: file, out, exclude: ['posts'] });
      const { readFileSync } = await import('node:fs');
      const written = readFileSync(out, 'utf8');
      expect(written).toContain('users');
      expect(written).not.toContain('posts');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('lists available tables when the filter matches nothing', async () => {
    const { dir, file } = createDatabase();
    try {
      const out = join(dir, 'schema.ts');
      await expect(runGenerate({ url: file, out, tables: ['nope'] })).rejects.toThrow(
        'Available tables: users, posts',
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe.skipIf(!sqliteAvailable)('write errors', () => {
  it('reports a missing output directory clearly', async () => {
    const { dir, file } = createDatabase();
    try {
      const out = join(dir, 'missing-dir', 'schema.ts');
      await expect(runGenerate({ url: file, out })).rejects.toThrow('directory does not exist');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('formatCliError', () => {
  it('unwraps AggregateError to the first inner message', () => {
    const aggregate = new AggregateError([new Error('connect ECONNREFUSED ::1:5432')], '');
    expect(formatCliError(aggregate)).toBe('connect ECONNREFUSED ::1:5432');
  });

  it('falls back to a generic message for empty AggregateErrors', () => {
    expect(formatCliError(new AggregateError([], ''))).toBe('Connection failed.');
  });

  it('passes ordinary errors through', () => {
    expect(formatCliError(new Error('boom'))).toBe('boom');
  });
});
