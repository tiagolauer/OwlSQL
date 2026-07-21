import type { ConnectionPool } from 'mssql';
import type { DialectExecutor, QueryMeta } from '../index.js';
import { collectNamedParameters } from './named-params.js';

const MSSQL_PARAM_PREFIXES: ReadonlySet<string> = new Set(['@']);

export function createMssqlExecutor(pool: ConnectionPool): DialectExecutor<'at'> {
  return async (sql, params) => {
    const request = pool.request();

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
