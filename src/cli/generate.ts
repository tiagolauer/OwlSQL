import { readFile, writeFile } from 'node:fs/promises';
import type { ConnectionInfo, Dialect, TableSchema } from './types.js';
import { renderSchema } from './codegen.js';
import { introspectPostgres } from './dialects/postgres.js';
import { introspectMysql } from './dialects/mysql.js';
import { introspectSqlite } from './dialects/sqlite.js';
import { introspectMssql } from './dialects/mssql.js';
import { redactCredentials } from './redact.js';

export interface GenerateOptions {
  url: string;
  out: string;
  dialect?: Dialect | undefined;
  schema?: string | undefined;
  tables?: string[] | undefined;
  exclude?: string[] | undefined;
  check?: boolean | undefined;
}

export type GenerateResult =
  | { kind: 'written'; warnings?: string[] }
  | { kind: 'upToDate'; warnings?: string[] }
  | { kind: 'drift'; summary: string; warnings?: string[] };

const SCHEME_PATTERN = /^[a-z][a-z0-9+.-]*:\/\//i;

const ADO_MSSQL_PATTERN = /(^|;)\s*(server|data source|address|addr|network address)\s*=/i;

// A connection URL whose "//" was mistyped as a single "/" (e.g.
// "postgres:/user:pass@host/db") still carries embedded credentials but matches
// neither SCHEME_PATTERN (needs "://") nor ADO_MSSQL_PATTERN. The leading
// negative lookahead excludes Windows drive-letter paths ("C:/app@prod.db"),
// which are valid SQLite file paths, not mistyped URLs.
const MISTYPED_URL_CREDENTIALS_PATTERN = /^(?![a-z]:[/\\])[a-z][a-z0-9+.-]*:\/{1,2}[^/@\s]*@/i;

// An ADO / DSN key=value connection string that omits a "server="-style keyword
// (e.g. "Uid=sa;Pwd=secret;Initial Catalog=db"). Not a SQLite file path either.
const ADO_CREDENTIALS_PATTERN =
  /(^|;)\s*(uid|user id|pwd|password|database|initial catalog|trusted_connection|integrated security|driver|dsn)\s*=/i;

export { redactCredentials } from './redact.js';

function unrecognizedUrlError(url: string): Error {
  return new Error(
    `Unrecognized connection URL "${redactCredentials(url)}". Expected postgres://, postgresql://, mysql://, mssql://, sqlserver://, or a path to a SQLite database file.`,
  );
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
    throw unrecognizedUrlError(url);
  }

  // A mistyped connection URL (single-slash scheme, or an ADO/DSN string missing
  // a "server=" keyword) must not fall through to sqlite: introspectSqlite would
  // then echo the raw string — password included — verbatim to stderr (#134).
  if (MISTYPED_URL_CREDENTIALS_PATTERN.test(url) || ADO_CREDENTIALS_PATTERN.test(url)) {
    throw unrecognizedUrlError(url);
  }

  return 'sqlite';
}

const INTROSPECTORS: Record<Dialect, (connection: ConnectionInfo) => Promise<TableSchema[]>> = {
  postgres: introspectPostgres,
  mysql: introspectMysql,
  sqlite: introspectSqlite,
  mssql: introspectMssql,
};

// A name in --table/--exclude that matches nothing is a typo, and silently
// honoring it means a table quietly missing from the generated schema, found
// much later as an `unknown` row type (issue #240).
function unmatchedNames(requested: string[] | undefined, tables: TableSchema[]): string[] {
  if (requested === undefined) {
    return [];
  }

  const available = new Set(tables.map((table) => table.name.toLowerCase()));
  return requested.filter((name) => !available.has(name.toLowerCase()));
}

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

async function readExistingFile(path: string): Promise<string | null> {
  try {
    return await readFile(path, 'utf8');
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

// A full diff would need a diff library this CLI doesn't otherwise depend
// on; pointing at the first differing line is enough to act on without one.
function summarizeDrift(existing: string | null, generated: string): string {
  if (existing === null) {
    return 'the file does not exist yet.';
  }

  const existingLines = existing.split('\n');
  const generatedLines = generated.split('\n');
  const lineCount = Math.max(existingLines.length, generatedLines.length);

  for (let index = 0; index < lineCount; index += 1) {
    const currentLine = existingLines[index];
    const generatedLine = generatedLines[index];
    if (currentLine !== generatedLine) {
      return (
        `first differs at line ${index + 1}:\n` +
        `  current:   ${currentLine ?? '(end of file)'}\n` +
        `  generated: ${generatedLine ?? '(end of file)'}`
      );
    }
  }

  return 'differs only in trailing whitespace or line endings.';
}

export async function runGenerate(options: GenerateOptions): Promise<GenerateResult> {
  const dialect = options.dialect ?? detectDialect(options.url);
  const connection: ConnectionInfo = { url: options.url, schema: options.schema };

  const introspected = await INTROSPECTORS[dialect](connection);

  if (introspected.length === 0) {
    throw new Error('No tables found. Check the connection URL and --schema, if provided.');
  }

  const availableNames = introspected.map((table) => table.name).join(', ');
  const missing = unmatchedNames(options.tables, introspected);

  if (missing.length > 0) {
    throw new Error(
      `--table matched no such table: ${missing.join(', ')}. Available tables: ${availableNames}`,
    );
  }

  const tables = filterTables(introspected, options);

  if (tables.length === 0) {
    throw new Error(`No tables left after filtering. Available tables: ${availableNames}`);
  }

  // An unmatched --exclude only warns: excluding a table that isn't there is
  // still the outcome the caller asked for, and scripts legitimately exclude
  // tables that exist in some environments and not others.
  const notExcluded = unmatchedNames(options.exclude, introspected);
  const warnings =
    notExcluded.length === 0
      ? {}
      : { warnings: [`--exclude matched no such table: ${notExcluded.join(', ')}`] };

  const source = renderSchema(tables);

  if (options.check) {
    const existing = await readExistingFile(options.out);
    return existing === source
      ? { kind: 'upToDate', ...warnings }
      : { kind: 'drift', summary: summarizeDrift(existing, source), ...warnings };
  }

  try {
    await writeFile(options.out, source, 'utf8');
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      throw new Error(`Cannot write "${options.out}": the directory does not exist.`);
    }
    throw error;
  }

  return { kind: 'written', ...warnings };
}
