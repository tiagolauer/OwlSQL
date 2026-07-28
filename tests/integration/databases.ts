import type { ExecutorResult, QueryMeta } from '../../src/index.js';

export const PG_URL_ENV = 'OWLSQL_PG_URL';
export const MYSQL_URL_ENV = 'OWLSQL_MYSQL_URL';
export const MSSQL_URL_ENV = 'OWLSQL_MSSQL_URL';

function readUrl(name: string): string | undefined {
  const value = process.env[name];
  return value !== undefined && value.length > 0 ? value : undefined;
}

export const pgUrl = readUrl(PG_URL_ENV);
export const mysqlUrl = readUrl(MYSQL_URL_ENV);
export const mssqlUrl = readUrl(MSSQL_URL_ENV);

export function requireUrl(url: string | undefined, name: string): string {
  if (url === undefined) {
    throw new Error(
      `${name} is not set. Start the integration databases with: docker compose -f docker-compose.integration.yml up -d`,
    );
  }
  return url;
}

export function rowsOf(result: ExecutorResult): unknown[] {
  return Array.isArray(result) ? result : result.rows;
}

export function metaOf(result: ExecutorResult): QueryMeta {
  return Array.isArray(result) ? {} : (result.meta ?? {});
}
