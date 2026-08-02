import type { ConnectionInfo, TableSchema } from '../types.js';

const MSSQL_SCALAR_TYPES: Record<string, string> = {
  int: 'number',
  smallint: 'number',
  tinyint: 'number',
  float: 'number',
  real: 'number',
  bigint: 'string',
  decimal: 'number',
  numeric: 'number',
  money: 'number',
  smallmoney: 'number',
  bit: 'boolean',
  char: 'string',
  varchar: 'string',
  nchar: 'string',
  nvarchar: 'string',
  text: 'string',
  ntext: 'string',
  uniqueidentifier: 'string',
  xml: 'string',
  date: 'Date',
  datetime: 'Date',
  datetime2: 'Date',
  smalldatetime: 'Date',
  time: 'Date',
  datetimeoffset: 'Date',
  binary: 'Buffer',
  varbinary: 'Buffer',
  image: 'Buffer',
};

export function mapMssqlType(typeName: string): string {
  return MSSQL_SCALAR_TYPES[typeName.toLowerCase()] ?? 'unknown';
}

interface MssqlColumnRow {
  table_name: string;
  column_name: string;
  data_type: string;
  is_nullable: boolean;
}

export interface MssqlConnectionConfig {
  server: string;
  user?: string;
  password?: string;
  database?: string;
  port?: number;
  options: {
    encrypt: boolean;
    trustServerCertificate: boolean;
    instanceName?: string;
  };
}

const MSSQL_URL_PATTERN = /^(mssql|sqlserver):\/\//i;

const INSTANCE_SEPARATOR = '\\';

// `host\INSTANCE` is the default shape of a Windows SQL Server install, and a
// backslash is a forbidden host character, so `new URL` rejects the URL
// outright. Percent-encoding it first keeps the authority parseable (the host
// stays opaque for a non-special scheme, so its case survives) and the instance
// is split back out below into the driver's own instanceName option (#239).
function parseMssqlUrl(url: string): URL {
  try {
    return new URL(url.split(INSTANCE_SEPARATOR).join('%5C'));
  } catch {
    throw new Error(
      'Invalid SQL Server connection URL. Expected mssql://user:password@host[\\INSTANCE][:port]/database, or an ADO string such as "Server=host;Database=db;User Id=user;Password=password".',
    );
  }
}

// `new URL` accepts a broken percent sequence and keeps it verbatim, so the
// throw lands here instead, as a bare URIError with no hint of which input
// caused it (#306). A raw `%` in a password is the likely reason, and the
// decoded value never reaches the message: this is the credential half of the
// URL.
function decodeUrlPart(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    throw new Error(
      'Invalid SQL Server connection URL: it contains an incomplete percent-escape. A literal % in a user, password or database name has to be written as %25. Expected mssql://user:password@host[\\INSTANCE][:port]/database, or an ADO string such as "Server=host;Database=db;User Id=user;Password=password".',
    );
  }
}

export function mssqlUrlToConfig(url: string): MssqlConnectionConfig {
  const parsed = parseMssqlUrl(url);
  const flags = parsed.searchParams;

  const host = decodeUrlPart(parsed.hostname);
  const separatorIndex = host.indexOf(INSTANCE_SEPARATOR);
  const instanceName = separatorIndex === -1 ? '' : host.slice(separatorIndex + 1);

  const config: MssqlConnectionConfig = {
    server: separatorIndex === -1 ? host : host.slice(0, separatorIndex),
    options: {
      encrypt: flags.get('encrypt') !== 'false',
      trustServerCertificate: flags.get('trustServerCertificate') === 'true',
    },
  };

  if (instanceName) {
    config.options.instanceName = instanceName;
  }

  if (parsed.username) {
    config.user = decodeUrlPart(parsed.username);
  }
  if (parsed.password) {
    config.password = decodeUrlPart(parsed.password);
  }
  const database = parsed.pathname.replace(/^\//, '');
  if (database) {
    config.database = decodeUrlPart(database);
  }
  if (parsed.port) {
    config.port = Number(parsed.port);
  }

  return config;
}

export async function introspectMssql(connection: ConnectionInfo): Promise<TableSchema[]> {
  let connect: typeof import('mssql').connect;
  try {
    ({ connect } = await import('mssql'));
  } catch {
    throw new Error(
      "The 'mssql' package is required to introspect SQL Server. Install it with: npm install mssql",
    );
  }

  const pool = MSSQL_URL_PATTERN.test(connection.url)
    ? await connect(mssqlUrlToConfig(connection.url) as import('mssql').config)
    : await connect(connection.url);
  const schema = connection.schema ?? 'dbo';

  try {
    const tablesResult = await pool
      .request()
      .input('schema', schema)
      .query<{ table_name: string }>(
        `select t.name as table_name
         from sys.tables t
         where schema_name(t.schema_id) = @schema
         order by t.name`,
      );

    const result = await pool
      .request()
      .input('schema', schema)
      .query<MssqlColumnRow>(
        `select t.name as table_name, c.name as column_name,
                type_name(c.system_type_id) as data_type,
                c.is_nullable as is_nullable
         from sys.tables t
         join sys.columns c on c.object_id = t.object_id
         where schema_name(t.schema_id) = @schema
         order by t.name, c.column_id`,
      );

    return groupColumns(
      result.recordset,
      tablesResult.recordset.map((row) => row.table_name),
    );
  } finally {
    await pool.close().catch(() => undefined);
  }
}

function groupColumns(rows: MssqlColumnRow[], tableNames: string[]): TableSchema[] {
  const tables = new Map<string, TableSchema>();

  for (const name of tableNames) {
    tables.set(name, { name, columns: [] });
  }

  for (const row of rows) {
    const table = tables.get(row.table_name) ?? { name: row.table_name, columns: [] };
    table.columns.push({
      name: row.column_name,
      tsType: mapMssqlType(row.data_type),
      nullable: row.is_nullable,
    });
    tables.set(row.table_name, table);
  }

  return [...tables.values()];
}
