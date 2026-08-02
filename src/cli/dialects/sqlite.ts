import { existsSync } from 'node:fs';
import type { ConnectionInfo, TableSchema } from '../types.js';

export function mapSqliteType(declaredType: string): string {
  const type = declaredType.toUpperCase().trim();

  if (type === 'BOOLEAN') {
    return '0 | 1';
  }

  if (type === 'DATE' || type === 'DATETIME' || type === 'TIMESTAMP') {
    return 'string';
  }

  // A JSON column has NUMERIC affinity, and a JSON document is not a
  // well-formed number, so SQLite stores it as TEXT and node:sqlite hands
  // back a string. It used to reach the fallback below and be typed `number`
  // (issue #252).
  if (type === 'JSON' || type === 'JSONB') {
    return 'string';
  }

  if (type.includes('INT')) {
    return 'number';
  }

  if (type.includes('CHAR') || type.includes('CLOB') || type.includes('TEXT')) {
    return 'string';
  }

  if (type.includes('BLOB') || type === '') {
    // node:sqlite has no typeCast hook (same constraint as mysql2, #135) -
    // its documented output type for a blob column is a plain Uint8Array,
    // never a Buffer instance (@types/node/sqlite.d.ts's SQLOutputValue).
    return 'Uint8Array';
  }

  if (type.includes('REAL') || type.includes('FLOA') || type.includes('DOUB')) {
    return 'number';
  }

  // The NUMERIC-affinity names people actually declare. Everything past this
  // point is a type SQLite gives NUMERIC affinity without any hint about what
  // is stored in it, so it degrades to `unknown` the way an unrecognized type
  // already does in the other three introspectors - claiming `number` for it
  // was a guess that a JSON or an enum-ish column silently broke (issue #252).
  if (type.includes('NUM') || type.includes('DEC') || type.includes('MONEY')) {
    return 'number';
  }

  return 'unknown';
}

interface SqliteTableInfoRow {
  name: string;
  type: string;
  notnull: number;
  pk: number;
}

function isRowidAlias(column: SqliteTableInfoRow, primaryKeyCount: number): boolean {
  return (
    column.pk > 0 && primaryKeyCount === 1 && column.type.toUpperCase().trim() === 'INTEGER'
  );
}

// Longest first: `file://x` must not be stripped as `file:` and keep a leading
// `//`. Every spelling detectDialect routes to sqlite has to be listed here, or
// the prefix survives into existsSync and the file is reported missing under a
// name nobody wrote (issue #236).
const SQLITE_URL_PREFIXES = ['sqlite://', 'sqlite:', 'file://', 'file:'];

// RFC 8089 puts an empty authority before an absolute path, so a Windows file
// URL reads `file:///C:/data/app.db` and stripping `file://` leaves the
// authority's slash glued to the drive letter. existsSync then tests
// `/C:/data/app.db` and reports a path nobody wrote (issue #305). On POSIX the
// same strip is already correct, and there is no drive letter to match.
const AUTHORITY_SLASH_BEFORE_DRIVE = /^\/[a-zA-Z]:[/\\]/;

export function normalizeSqlitePath(url: string): string {
  for (const prefix of SQLITE_URL_PREFIXES) {
    if (url.startsWith(prefix)) {
      const path = url.slice(prefix.length);
      return AUTHORITY_SLASH_BEFORE_DRIVE.test(path) ? path.slice(1) : path;
    }
  }
  return url;
}

function isMemoryDatabase(path: string): boolean {
  return path === ':memory:' || path.startsWith('file::memory:');
}

export async function introspectSqlite(connection: ConnectionInfo): Promise<TableSchema[]> {
  let DatabaseSyncCtor: typeof import('node:sqlite').DatabaseSync;
  try {
    ({ DatabaseSync: DatabaseSyncCtor } = await import('node:sqlite'));
  } catch {
    throw new Error(
      "'node:sqlite' is not available in this Node.js version. Upgrade to Node >=22.5, or use better-sqlite3 and edit the generated schema by hand.",
    );
  }

  const path = connection.url.startsWith('file::memory:')
    ? connection.url
    : normalizeSqlitePath(connection.url);

  if (!isMemoryDatabase(path) && !existsSync(path)) {
    throw new Error(`SQLite database file not found: "${path}".`);
  }

  const db = new DatabaseSyncCtor(path, { readOnly: !isMemoryDatabase(path) });

  try {
    const tableRows = db
      .prepare("select name from sqlite_master where type = 'table' and name not like 'sqlite_%'")
      .all() as { name: string }[];

    return tableRows.map((tableRow) => {
      const columns = db
        .prepare(`PRAGMA table_info(${quoteIdentifier(tableRow.name)})`)
        .all() as unknown as SqliteTableInfoRow[];

      const primaryKeyCount = columns.filter((column) => column.pk > 0).length;

      return {
        name: tableRow.name,
        columns: columns.map((column) => ({
          name: column.name,
          tsType: mapSqliteType(column.type),
          nullable: column.notnull === 0 && !isRowidAlias(column, primaryKeyCount),
        })),
      };
    });
  } finally {
    db.close();
  }
}

function quoteIdentifier(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}
