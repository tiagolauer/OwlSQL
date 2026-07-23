import type { ConnectionPool, Transaction, Request } from 'mssql';
import type { DialectExecutor, QueryMeta } from '../index.js';
import { collectNamedParameters } from './named-params.js';

const MSSQL_PARAM_PREFIXES: ReadonlySet<string> = new Set(['@']);

export type MssqlQueryable = ConnectionPool | Transaction | Request;

function isRequestSource(source: MssqlQueryable): source is ConnectionPool | Transaction {
  return typeof (source as { request?: unknown }).request === 'function';
}

export function createMssqlExecutor(source: MssqlQueryable): DialectExecutor<'at'> {
  return async (sql, params) => {
    // A ConnectionPool or an already-open Transaction each need `.request()`
    // called to get a Request bound to that connection/transaction; a
    // Request passed directly is already bound and used as-is - this is what
    // lets a caller route a query through an open transaction instead of
    // always implicitly starting a new, separately-committed request.
    const request = isRequestSource(source) ? source.request() : source;

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
