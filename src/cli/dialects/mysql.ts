import type { ConnectionInfo, TableSchema } from '../types.js';

const MYSQL_SCALAR_TYPES: Record<string, string> = {
  tinyint: 'number',
  smallint: 'number',
  mediumint: 'number',
  int: 'number',
  integer: 'number',
  year: 'number',
  float: 'number',
  double: 'number',
  bigint: 'string',
  decimal: 'string',
  numeric: 'string',
  char: 'string',
  varchar: 'string',
  text: 'string',
  tinytext: 'string',
  mediumtext: 'string',
  longtext: 'string',
  enum: 'string',
  set: 'string',
  time: 'string',
  date: 'Date',
  datetime: 'Date',
  timestamp: 'Date',
  json: 'unknown',
  binary: 'Buffer',
  varbinary: 'Buffer',
  blob: 'Buffer',
  tinyblob: 'Buffer',
  mediumblob: 'Buffer',
  longblob: 'Buffer',
  bit: 'Buffer',
};

export function mapMysqlType(dataType: string, columnType: string): string {
  const type = dataType.toLowerCase();
  const fullType = columnType.toLowerCase();

  if (type === 'tinyint' && fullType.startsWith('tinyint(1)')) {
    return 'boolean';
  }

  if (type === 'bit' && fullType.startsWith('bit(1)')) {
    return 'boolean';
  }

  return MYSQL_SCALAR_TYPES[type] ?? 'unknown';
}

interface MysqlColumnRow {
  table_name: string;
  column_name: string;
  data_type: string;
  column_type: string;
  is_nullable: 'YES' | 'NO';
}

export async function introspectMysql(connection: ConnectionInfo): Promise<TableSchema[]> {
  let createConnection: typeof import('mysql2/promise').createConnection;
  try {
    ({ createConnection } = await import('mysql2/promise'));
  } catch {
    throw new Error(
      "The 'mysql2' package is required to introspect MySQL. Install it with: npm install mysql2",
    );
  }

  const connectionHandle = await createConnection(connection.url);

  try {
    const [rows] = await connectionHandle.query(
      connection.schema
        ? `select table_name, column_name, data_type, column_type, is_nullable
           from information_schema.columns
           where table_schema = ?
           order by table_name, ordinal_position`
        : `select table_name, column_name, data_type, column_type, is_nullable
           from information_schema.columns
           where table_schema = database()
           order by table_name, ordinal_position`,
      connection.schema ? [connection.schema] : [],
    );

    return groupColumns(rows as unknown as MysqlColumnRow[]);
  } finally {
    await connectionHandle.end();
  }
}

function groupColumns(rows: MysqlColumnRow[]): TableSchema[] {
  const tables = new Map<string, TableSchema>();

  for (const row of rows) {
    const table = tables.get(row.table_name) ?? { name: row.table_name, columns: [] };
    table.columns.push({
      name: row.column_name,
      tsType: mapMysqlType(row.data_type, row.column_type),
      nullable: row.is_nullable === 'YES',
    });
    tables.set(row.table_name, table);
  }

  return [...tables.values()];
}
