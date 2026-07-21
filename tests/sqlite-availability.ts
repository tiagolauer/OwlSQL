type DatabaseSyncCtor = typeof import('node:sqlite').DatabaseSync;

let databaseSync: DatabaseSyncCtor | undefined;

try {
  ({ DatabaseSync: databaseSync } = await import('node:sqlite'));
} catch {
  databaseSync = undefined;
}

export const sqliteAvailable = databaseSync !== undefined;

export function loadSqlite(): DatabaseSyncCtor {
  if (!databaseSync) {
    throw new Error('node:sqlite is not available in this Node.js version');
  }
  return databaseSync;
}
