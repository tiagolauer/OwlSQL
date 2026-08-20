import { describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { detectDialect, generateSchema } from '../src/tooling/schema-generator/generate.js';
import { loadSqlite, sqliteAvailable } from './sqlite-availability.js';
import { normalizeSqlitePath } from '../src/tooling/introspection/sqlite.js';
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
    // Regression for #236: detectDialect accepts this spelling, so the prefix
    // has to be stripped here too - it used to reach existsSync verbatim.
    expect(normalizeSqlitePath('file:./app.db')).toBe('./app.db');
    expect(normalizeSqlitePath('./app.db')).toBe('./app.db');
  });

  // Regression for #305: the RFC 8089 form carries an empty authority, so
  // stripping `file://` left its slash glued to the drive letter and the
  // missing-file error named `/C:/data/app.db`.
  it('drops the authority slash in front of a Windows drive letter', () => {
    expect(normalizeSqlitePath('file:///C:/data/app.db')).toBe('C:/data/app.db');
    expect(normalizeSqlitePath('file:///c:\\data\\app.db')).toBe('c:\\data\\app.db');
    expect(normalizeSqlitePath('sqlite:///C:/data/app.db')).toBe('C:/data/app.db');
  });

  it('keeps a POSIX absolute path absolute', () => {
    expect(normalizeSqlitePath('file:///var/data/app.db')).toBe('/var/data/app.db');
    expect(normalizeSqlitePath('sqlite:///var/data/app.db')).toBe('/var/data/app.db');
  });

  it('leaves the two nonstandard Windows spellings alone', () => {
    expect(normalizeSqlitePath('file://C:/data/app.db')).toBe('C:/data/app.db');
    expect(normalizeSqlitePath('file:C:/data/app.db')).toBe('C:/data/app.db');
  });

  it.skipIf(!sqliteAvailable)('introspects through a file: URL', async () => {
    const { dir, file } = createDatabase();
    try {
      const out = join(dir, 'schema.ts');
      await generateSchema({ url: `file:${file}`, out });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it.skipIf(!sqliteAvailable)('introspects through a sqlite:// URL', async () => {
    const { dir, file } = createDatabase();
    try {
      const out = join(dir, 'schema.ts');
      await generateSchema({ url: `sqlite://${file}`, out });
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
      await generateSchema({ url: file, out, tables: ['users'] });
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
      await generateSchema({ url: file, out, exclude: ['posts'] });
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
      await expect(generateSchema({ url: file, out, tables: ['nope'] })).rejects.toThrow(
        'Available tables: users, posts',
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  // Regression for #240: a typo used to be honored silently, so the table it
  // was meant to name simply went missing from the generated schema.
  it('rejects a --table name that matches no table, even when others match', async () => {
    const { dir, file } = createDatabase();
    try {
      const out = join(dir, 'schema.ts');
      await expect(
        generateSchema({ url: file, out, tables: ['users', 'ordrs'] }),
      ).rejects.toThrow('--table matched no such table: ordrs');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('warns but still generates when --exclude names a table that is not there', async () => {
    const { dir, file } = createDatabase();
    try {
      const out = join(dir, 'schema.ts');
      const result = await generateSchema({ url: file, out, exclude: ['posts', 'ordrs'] });
      expect(result).toEqual({
        kind: 'written',
        warnings: ['--exclude matched no such table: ordrs'],
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('reports no warnings when every filter name matches', async () => {
    const { dir, file } = createDatabase();
    try {
      const out = join(dir, 'schema.ts');
      expect(await generateSchema({ url: file, out, exclude: ['posts'] })).toEqual({
        kind: 'written',
      });
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
      await expect(generateSchema({ url: file, out })).rejects.toThrow('directory does not exist');
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
