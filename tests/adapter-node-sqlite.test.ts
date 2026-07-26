import { describe, it, expect, vi } from 'vitest';
import { createTypedDb, isOk } from '../src/index.js';
import { createNodeSqliteExecutor } from '../src/adapters/node-sqlite.js';
import { loadSqlite, sqliteAvailable } from './sqlite-availability.js';

interface DB {
  users: { id: number; name: string };
}

function seededDatabase(): import('node:sqlite').DatabaseSync {
  const DatabaseSync = loadSqlite();
  const db = new DatabaseSync(':memory:');
  db.exec('create table users (id integer primary key, name text not null)');
  db.prepare('insert into users (id, name) values (?, ?)').run(1, 'ada');
  db.prepare('insert into users (id, name) values (?, ?)').run(2, 'grace');
  return db;
}

describe.skipIf(!sqliteAvailable)('createNodeSqliteExecutor', () => {
  it('runs a real query against an in-memory node:sqlite database', async () => {
    const sqlite = seededDatabase();
    const db = createTypedDb<DB>(createNodeSqliteExecutor(sqlite));

    const result = await db.query('select id, name from users order by id');

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value).toEqual([
        { id: 1, name: 'ada' },
        { id: 2, name: 'grace' },
      ]);
      expect(result.meta).toBeUndefined();
    }
  });

  it('binds positional parameters through to the prepared statement', async () => {
    const sqlite = seededDatabase();
    const db = createTypedDb<DB>(createNodeSqliteExecutor(sqlite));

    const result = await db.query('select id, name from users where id = ?', 2);

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value).toEqual([{ id: 2, name: 'grace' }]);
    }
  });

  it('routes @name and $name placeholders through the named-parameters object', async () => {
    const sqlite = seededDatabase();
    const db = createTypedDb<DB>(createNodeSqliteExecutor(sqlite));

    const atResult = await db.query('select id, name from users where id = @id', 1);
    expect(isOk(atResult)).toBe(true);
    if (isOk(atResult)) {
      expect(atResult.value).toEqual([{ id: 1, name: 'ada' }]);
    }

    const dollarResult = await db.query('select id, name from users where name = $name', 'grace');
    expect(isOk(dollarResult)).toBe(true);
    if (isOk(dollarResult)) {
      expect(dollarResult.value).toEqual([{ id: 2, name: 'grace' }]);
    }
  });

  it('ignores named-parameter lookalikes inside string literals', async () => {
    const sqlite = seededDatabase();
    const db = createTypedDb<DB>(createNodeSqliteExecutor(sqlite));

    const result = await db.query("select id from users where name = 'no @param here' or id = ?", 1);

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value).toEqual([{ id: 1 }]);
    }
  });

  it('coerces boolean and Date params to driver-supported values', async () => {
    const DatabaseSync = loadSqlite();
    const sqlite = new DatabaseSync(':memory:');
    sqlite.exec('create table flags (id integer primary key, active integer, seen_at text)');
    const executor = createNodeSqliteExecutor(sqlite);

    const stamp = new Date('2026-01-02T03:04:05.000Z');
    await executor('insert into flags (id, active, seen_at) values (?, ?, ?)', [1, true, stamp]);

    const rows = await executor('select active, seen_at from flags where id = ?', [1]);
    expect(rows).toEqual([{ active: 1, seen_at: '2026-01-02T03:04:05.000Z' }]);
  });

  it('binds ? and a named parameter together without dropping the positional value', async () => {
    const sqlite = seededDatabase();
    const db = createTypedDb<DB>(createNodeSqliteExecutor(sqlite));

    const result = await db.query('select id, name from users where name = ? and id = @id', 'ada', 1);

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value).toEqual([{ id: 1, name: 'ada' }]);
    }
  });

  it('binds a repeated named parameter once, without misaligning the parameter after it', async () => {
    const DatabaseSync = loadSqlite();
    const sqlite = new DatabaseSync(':memory:');
    sqlite.exec('create table events (id integer primary key, note text, note2 text)');
    sqlite.prepare('insert into events (id, note, note2) values (1, ?, ?)').run('old', 'old');
    sqlite.prepare('insert into events (id, note, note2) values (2, ?, ?)').run('untouched', 'untouched');
    const executor = createNodeSqliteExecutor(sqlite);

    // note and note2 both bind to the same @note occurrence, deduped to one
    // slot; @id is a distinct third occurrence. If the previously-buggy
    // type demanded a slot per *occurrence* instead of per distinct name,
    // a caller following it would pass an extra positional value here,
    // shifting @id onto that extra value instead of the real id - and
    // event 1 would never actually be matched/updated.
    await executor('update events set note = @note, note2 = @note where id = @id', ['new', 1]);

    const rows = await executor('select id, note, note2 from events order by id', []);
    expect(rows).toEqual([
      { id: 1, note: 'new', note2: 'new' },
      { id: 2, note: 'untouched', note2: 'untouched' },
    ]);
  });

  it('reports write metadata without leaking stale values through the typed client', async () => {
    const sqlite = seededDatabase();
    const db = createTypedDb<DB>(createNodeSqliteExecutor(sqlite));

    const insert = await db.query('insert into users (id, name) values ($1, $2)', 9, 'lin');
    expect(isOk(insert)).toBe(true);
    if (isOk(insert)) {
      expect(insert.meta).toEqual({ rowCount: 1, lastInsertRowid: 9 });
    }

    const update = await db.query('update users set name = ? where id = ?', 'ada-lovelace', 1);
    expect(isOk(update)).toBe(true);
    if (isOk(update)) {
      expect(update.meta).toEqual({ rowCount: 1 });
    }

    const deleted = await db.query('delete from users where id = ?', 2);
    expect(isOk(deleted)).toBe(true);
    if (isOk(deleted)) {
      expect(deleted.meta).toEqual({ rowCount: 1 });
    }

    const deleteMiss = await db.query('delete from users where id = ?', 12345);
    expect(isOk(deleteMiss)).toBe(true);
    if (isOk(deleteMiss)) {
      expect(deleteMiss.meta).toEqual({ rowCount: 0 });
    }

    const ddl = await db.query('create table t2 (a integer)');
    expect(isOk(ddl)).toBe(true);
    if (isOk(ddl)) {
      expect(ddl.meta).toEqual({});
    }

    const rows = await db.query('select name from users where id = ?', 9);
    expect(isOk(rows)).toBe(true);
    if (isOk(rows)) {
      expect(rows.value).toEqual([{ name: 'lin' }]);
    }
  });
});

describe('createNodeSqliteExecutor column detection fallback', () => {
  it('classifies statements from SQL when StatementSync.columns is unavailable', async () => {
    const insertStatement = {
      run: vi.fn().mockReturnValue({ changes: 1, lastInsertRowid: 7 }),
      all: vi.fn().mockReturnValue([]),
    };
    const selectStatement = {
      run: vi.fn(),
      all: vi.fn().mockReturnValue([{ id: 7 }]),
    };
    const ddlStatement = {
      run: vi.fn().mockReturnValue({ changes: 4, lastInsertRowid: 99 }),
      all: vi.fn().mockReturnValue([]),
    };
    const returningStatement = {
      run: vi.fn(),
      all: vi.fn().mockReturnValue([{ id: 8 }]),
    };
    const statements: Record<string, unknown> = {
      'insert into users (name) values (?)': insertStatement,
      'select id from users': selectStatement,
      'create table t2 (a integer)': ddlStatement,
      'insert into users (name) values (?) returning id': returningStatement,
    };
    const sqlite = {
      prepare: vi.fn((sql: string) => statements[sql]),
    } as unknown as import('node:sqlite').DatabaseSync;
    const executor = createNodeSqliteExecutor(sqlite);

    await expect(executor('insert into users (name) values (?)', ['ada'])).resolves.toEqual({
      rows: [],
      meta: { rowCount: 1, lastInsertRowid: 7 },
    });
    expect(insertStatement.run).toHaveBeenCalledWith('ada');
    expect(insertStatement.all).not.toHaveBeenCalled();

    await expect(executor('select id from users', [])).resolves.toEqual([{ id: 7 }]);
    expect(selectStatement.all).toHaveBeenCalledWith();
    expect(selectStatement.run).not.toHaveBeenCalled();

    await expect(executor('create table t2 (a integer)', [])).resolves.toEqual({
      rows: [],
      meta: {},
    });
    expect(ddlStatement.run).toHaveBeenCalledWith();
    expect(ddlStatement.all).not.toHaveBeenCalled();

    await expect(
      executor('insert into users (name) values (?) returning id', ['grace']),
    ).resolves.toEqual([{ id: 8 }]);
    expect(returningStatement.all).toHaveBeenCalledWith('grace');
    expect(returningStatement.run).not.toHaveBeenCalled();
  });

  it('keeps the row path when StatementSync.columns throws', async () => {
    const statement = {
      columns: vi.fn(() => {
        throw new Error('columns unavailable');
      }),
      run: vi.fn(),
      all: vi.fn().mockReturnValue([{ id: 1 }]),
    };
    const sqlite = {
      prepare: vi.fn(() => statement),
    } as unknown as import('node:sqlite').DatabaseSync;
    const executor = createNodeSqliteExecutor(sqlite);

    await expect(executor('select id from users', [])).resolves.toEqual([{ id: 1 }]);
    expect(statement.all).toHaveBeenCalledWith();
    expect(statement.run).not.toHaveBeenCalled();
  });
});
