import { writeFile } from 'node:fs/promises';
import type { ConnectionInfo, Dialect, TableSchema } from './types.js';
import { renderSchema } from './codegen.js';
import { introspectPostgres } from './dialects/postgres.js';
import { introspectMysql } from './dialects/mysql.js';
import { introspectSqlite } from './dialects/sqlite.js';
import { introspectMssql } from './dialects/mssql.js';

export interface GenerateOptions {
  url: string;
  out: string;
  dialect?: Dialect | undefined;
  schema?: string | undefined;
  tables?: string[] | undefined;
  exclude?: string[] | undefined;
}

const SCHEME_PATTERN = /^[a-z][a-z0-9+.-]*:\/\//i;

const ADO_MSSQL_PATTERN = /(^|;)\s*(server|data source|address|addr|network address)\s*=/i;

const CREDENTIALS_PATTERN = /\/\/[^@/]+@/;

export function redactCredentials(url: string): string {
  return url.replace(CREDENTIALS_PATTERN, '//***@');
}

export function detectDialect(url: string): Dialect {
  if (url.startsWith('postgres://') || url.startsWith('postgresql://')) {
    return 'postgres';
  }

  if (url.startsWith('mysql://')) {
    return 'mysql';
  }

  if (url.startsWith('sqlite://') || url.startsWith('sqlite:') || url.startsWith('file:')) {
    return 'sqlite';
  }

  if (url.startsWith('mssql://') || url.startsWith('sqlserver://')) {
    return 'mssql';
  }

  if (ADO_MSSQL_PATTERN.test(url)) {
    return 'mssql';
  }

  if (SCHEME_PATTERN.test(url)) {
    throw new Error(
      `Unrecognized connection URL "${redactCredentials(url)}". Expected postgres://, postgresql://, mysql://, mssql://, sqlserver://, or a path to a SQLite database file.`,
    );
  }

  return 'sqlite';
}

const INTROSPECTORS: Record<Dialect, (connection: ConnectionInfo) => Promise<TableSchema[]>> = {
  postgres: introspectPostgres,
  mysql: introspectMysql,
  sqlite: introspectSqlite,
  mssql: introspectMssql,
};

function filterTables(tables: TableSchema[], options: GenerateOptions): TableSchema[] {
  const include = options.tables?.map((name) => name.toLowerCase());
  const exclude = options.exclude?.map((name) => name.toLowerCase());

  return tables.filter((table) => {
    const name = table.name.toLowerCase();
    if (include && !include.includes(name)) {
      return false;
    }
    if (exclude?.includes(name)) {
      return false;
    }
    return true;
  });
}

export async function runGenerate(options: GenerateOptions): Promise<void> {
  const dialect = options.dialect ?? detectDialect(options.url);
  const connection: ConnectionInfo = { url: options.url, schema: options.schema };

  const introspected = await INTROSPECTORS[dialect](connection);

  if (introspected.length === 0) {
    throw new Error('No tables found. Check the connection URL and --schema, if provided.');
  }

  const tables = filterTables(introspected, options);

  if (tables.length === 0) {
    throw new Error(
      `No tables left after filtering. Available tables: ${introspected
        .map((table) => table.name)
        .join(', ')}`,
    );
  }

  const source = renderSchema(tables);

  try {
    await writeFile(options.out, source, 'utf8');
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      throw new Error(`Cannot write "${options.out}": the directory does not exist.`);
    }
    throw error;
  }
}
