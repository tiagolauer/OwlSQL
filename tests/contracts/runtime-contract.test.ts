import { describe, expect, it } from 'vitest';
import {
  QueryErrorKind,
  ResultStatus,
  createTypedDb,
  isErr,
  isOk,
} from '../../src/index.js';
import { createRuntimeDb } from '../../src/runtime/db.js';

interface DB {
  users: { id: number; name: string };
}

describe('public runtime contract', () => {
  it('runtime db accepts plain strings without compiler types', async () => {
    const db = createRuntimeDb(async (sql, params) => {
      expect(sql).toBe('select 1');
      expect(params).toEqual([7]);
      return [{ value: 1 }];
    });

    const result = await db.query('select 1', [7]);
    expect(isOk(result)).toBe(true);
  });

  it('wraps rows in an OK Result', async () => {
    const db = createTypedDb<DB>(async () => [{ id: 1, name: 'Ada' }]);
    const result = await db.query('select id, name from users');

    expect(result.status).toBe(ResultStatus.Ok);
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value).toEqual([{ id: 1, name: 'Ada' }]);
    }
  });

  it('preserves executor metadata', async () => {
    const db = createTypedDb<DB>(async () => ({
      rows: [{ id: 1, name: 'Ada' }],
      meta: { rowCount: 1 },
    }));
    const result = await db.query('select id, name from users');

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.meta).toEqual({ rowCount: 1 });
    }
  });

  it('returns EMPTY_QUERY for blank SQL', async () => {
    const db = createTypedDb<DB>(async () => []);
    const result = await db.query('   ');

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.kind).toBe(QueryErrorKind.EmptyQuery);
    }
  });

  it('returns EXECUTOR_FAILED when the executor throws', async () => {
    const db = createTypedDb<DB>(async () => {
      throw new Error('boom');
    });
    const result = await db.query('select id from users');

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.kind).toBe(QueryErrorKind.ExecutorFailed);
      expect(result.error.cause).toBeInstanceOf(Error);
    }
  });
});
