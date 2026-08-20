import type { ConnectionPool, Transaction, Request } from 'mssql';
import type { TypedDb, TypedDbOptions } from '../public/client.js';
import { createTypedDb } from '../public/client.js';
import type { DialectExecutor } from '../runtime/executor.js';
import type { QueryMeta } from '../runtime/result.js';
import type { SchemaLike } from '../schema/model.js';
import { collectNamedParameters } from './named-params.js';
import { rollbackAndRethrow } from './transaction.js';

const MSSQL_PARAM_PREFIXES: ReadonlySet<string> = new Set(['@']);

export type MssqlQueryable = ConnectionPool | Transaction | Request;

function isRequestSource(source: MssqlQueryable): source is ConnectionPool | Transaction {
  return typeof (source as { request?: unknown }).request === 'function';
}

// A ConnectionPool or an already-open Transaction each need `.request()` called
// to get a Request bound to that connection/transaction; a Request passed
// directly is already bound and used as-is - this is what lets a caller route a
// query through an open transaction instead of always implicitly starting a
// new, separately-committed request.
//
// That Request is reused across every query() on this executor, and node-mssql
// throws on `input()` for a name it has already seen and never clears the bag
// between calls - so without the reset a second query with the same @name
// failed, and one with different names silently carried the first query's
// values along (issue #235).
function requestFor(source: MssqlQueryable): Request {
  if (isRequestSource(source)) {
    return source.request();
  }

  source.parameters = {};
  return source;
}

export function createMssqlExecutor(source: MssqlQueryable): DialectExecutor<'at'> {
  return async (sql, params) => {
    const request = requestFor(source);

    collectNamedParameters(sql, MSSQL_PARAM_PREFIXES).forEach((name, index) => {
      request.input(name.slice(1), params[index] ?? null);
    });

    const result = await request.query(sql);
    const meta: QueryMeta = {};
    if (typeof result.rowsAffected?.[0] === 'number') {
      meta.rowCount = result.rowsAffected[0];
    }
    return { rows: result.recordset ?? [], meta };
  };
}

// A BEGIN TRAN/COMMIT run through an executor bound to the pool is a
// footgun - each query() would implicitly open its own Request against a
// fresh connection, never actually joining the transaction. pool.transaction()
// pins one connection for the whole callback, exactly the pattern already
// documented by hand in the README's transactions section; commit/rollback
// already release that connection back to the pool, no separate release step
// needed.
//
// Curried on DB, same as createPgTransaction - see the comment there for why
// a single combined call would silently break inference of the callback's
// return type.
export function createMssqlTransaction<DB extends SchemaLike>(pool: ConnectionPool) {
  return async function runMssqlTransaction<
    const Options extends Omit<TypedDbOptions, 'placeholders'> = TypedDbOptions,
    T = unknown,
  >(
    fn: (tx: TypedDb<DB, Options extends { strict: true } ? true : false, 'at'>) => Promise<T>,
    options?: Options,
  ): Promise<T> {
    const transaction = pool.transaction();
    const tx = createTypedDb<DB, Options & { placeholders: 'at' }>(
      createMssqlExecutor(transaction),
      { ...options, placeholders: 'at' } as Options & { placeholders: 'at' },
    );

    // begin() stays outside the try: node-mssql throws "Transaction has not
    // begun" when rollback() runs on a transaction that never started, so a
    // pool that can't reach the server would report a transaction-state
    // problem instead of the connection failure that actually happened.
    await transaction.begin();

    try {
      const result = await fn(tx);
      await transaction.commit();
      return result;
    } catch (error) {
      return await rollbackAndRethrow(error, () => transaction.rollback());
    }
  };
}
