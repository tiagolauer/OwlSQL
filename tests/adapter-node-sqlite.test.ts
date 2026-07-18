import { describe, it, expect } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { createTypedDb, isOk } from '../src/index';
import { createNodeSqliteExecutor } from '../src/adapters/node-sqlite';

interface DB {
  users: { id: number; name: string };
}

function seededDatabase(): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  db.exec('create table users (id integer primary key, name text not null)');
  db.prepare('insert into users (id, name) values (?, ?)').run(1, 'ada');
  db.prepare('insert into users (id, name) values (?, ?)').run(2, 'grace');
  return db;
}

describe('createNodeSqliteExecutor', () => {
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
});
