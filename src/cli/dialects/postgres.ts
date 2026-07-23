import type { ConnectionInfo, TableSchema } from '../types.js';

const POSTGRES_SCALAR_TYPES: Record<string, string> = {
  int2: 'number',
  int4: 'number',
  float4: 'number',
  float8: 'number',
  int8: 'string',
  numeric: 'string',
  money: 'string',
  bool: 'boolean',
  text: 'string',
  varchar: 'string',
  bpchar: 'string',
  char: 'string',
  uuid: 'string',
  citext: 'string',
  name: 'string',
  xml: 'string',
  json: 'unknown',
  jsonb: 'unknown',
  bytea: 'Buffer',
  timestamp: 'Date',
  timestamptz: 'Date',
  date: 'Date',
  time: 'string',
  timetz: 'string',
  // interval decodes to a structured { years, months, days, ... } object at
  // both scalar and array positions (the `postgres-interval` package), not a
  // string - see POSTGRES_SCALAR_TYPES lookup below, which special-cases it.
  inet: 'string',
  cidr: 'string',
  macaddr: 'string',
  macaddr8: 'string',
  bit: 'string',
  varbit: 'string',
  tsvector: 'string',
  tsquery: 'string',
  oid: 'number',
};

// pg only decodes an array column into a real JS array for the base types
// pg-types has a static OID registered for (verified against every
// register(...) call in pg-types/lib/textParsers.js). Everything else -
// including enum arrays, whose OIDs are assigned per-database at CREATE TYPE
// time and can never be statically registered - falls through to pg-types'
// unregistered-OID fallback, which hands back the raw wire-format string
// ("{happy,sad}"), not an array.
const POSTGRES_ARRAY_SAFE_TYPES: ReadonlySet<string> = new Set([
  'int2',
  'int4',
  'int8',
  'oid',
  'float4',
  'float8',
  'bool',
  'text',
  'varchar',
  'bpchar',
  'uuid',
  'money',
  'bytea',
  'timestamp',
  'timestamptz',
  'date',
  'time',
  'timetz',
  'inet',
  'cidr',
  'macaddr',
  'json',
  'jsonb',
  'interval',
]);

// numeric[] decodes element-wise with parseFloat (real numbers), unlike the
// scalar numeric mapping ('string', to avoid precision loss).
const POSTGRES_ARRAY_TYPE_OVERRIDES: Record<string, string> = {
  numeric: 'number',
};

function renderEnumUnion(labels: string[]): string {
  return labels.map((label) => `'${label.replace(/'/g, "\\'")}'`).join(' | ');
}

function scalarType(base: string): string {
  if (base === 'interval') {
    return 'unknown';
  }
  return POSTGRES_SCALAR_TYPES[base] ?? 'unknown';
}

export function mapPostgresType(udtName: string, enums?: Map<string, string[]>): string {
  const isArray = udtName.startsWith('_');
  const base = isArray ? udtName.slice(1) : udtName;

  const labels = enums?.get(base);
  if (labels && labels.length > 0) {
    const union = renderEnumUnion(labels);
    return isArray ? 'string' : union;
  }

  if (!isArray) {
    return scalarType(base);
  }

  const override = POSTGRES_ARRAY_TYPE_OVERRIDES[base];
  if (override) {
    return `${override}[]`;
  }

  return POSTGRES_ARRAY_SAFE_TYPES.has(base) ? `${scalarType(base)}[]` : 'string';
}

interface PgColumnRow {
  table_name: string;
  column_name: string;
  udt_name: string;
  is_nullable: 'YES' | 'NO';
}

interface PgEnumRow {
  typname: string;
  enumlabel: string;
}

export async function introspectPostgres(connection: ConnectionInfo): Promise<TableSchema[]> {
  let PoolCtor: typeof import('pg').Pool;
  try {
    ({ Pool: PoolCtor } = await import('pg'));
  } catch {
    throw new Error(
      "The 'pg' package is required to introspect PostgreSQL. Install it with: npm install pg",
    );
  }

  const pool = new PoolCtor({ connectionString: connection.url });
  const schema = connection.schema ?? 'public';

  try {
    const tablesResult = await pool.query<{ table_name: string }>(
      `select table_name
       from information_schema.tables
       where table_schema = $1 and table_type = 'BASE TABLE'
       order by table_name`,
      [schema],
    );

    const enumsResult = await pool.query<PgEnumRow>(
      `select t.typname as typname, e.enumlabel as enumlabel
       from pg_enum e
       join pg_type t on t.oid = e.enumtypid
       join pg_namespace n on n.oid = t.typnamespace
       where n.nspname = $1
       order by t.typname, e.enumsortorder`,
      [schema],
    );

    const result = await pool.query<PgColumnRow>(
      `select c.table_name, c.column_name, c.udt_name, c.is_nullable
       from information_schema.columns c
       join information_schema.tables t
         on t.table_schema = c.table_schema and t.table_name = c.table_name
       where c.table_schema = $1 and t.table_type = 'BASE TABLE'
       order by c.table_name, c.ordinal_position`,
      [schema],
    );

    return groupColumns(
      result.rows,
      tablesResult.rows.map((row) => row.table_name),
      buildEnumMap(enumsResult.rows),
    );
  } finally {
    await pool.end().catch(() => undefined);
  }
}

function buildEnumMap(rows: PgEnumRow[]): Map<string, string[]> {
  const enums = new Map<string, string[]>();

  for (const row of rows) {
    const labels = enums.get(row.typname) ?? [];
    labels.push(row.enumlabel);
    enums.set(row.typname, labels);
  }

  return enums;
}

function groupColumns(
  rows: PgColumnRow[],
  tableNames: string[],
  enums: Map<string, string[]>,
): TableSchema[] {
  const tables = new Map<string, TableSchema>();

  for (const name of tableNames) {
    tables.set(name, { name, columns: [] });
  }

  for (const row of rows) {
    const table = tables.get(row.table_name) ?? { name: row.table_name, columns: [] };
    table.columns.push({
      name: row.column_name,
      tsType: mapPostgresType(row.udt_name, enums),
      nullable: row.is_nullable === 'YES',
    });
    tables.set(row.table_name, table);
  }

  return [...tables.values()];
}
