export interface ColumnSchema {
  name: string;
  tsType: string;
  nullable: boolean;
}

export interface TableSchema {
  name: string;
  columns: ColumnSchema[];
}

export type Dialect = 'postgres' | 'mysql' | 'sqlite' | 'mssql';

export interface IntrospectionOptions {
  url: string;
  schema?: string | undefined;
  tables?: string[] | undefined;
  exclude?: string[] | undefined;
}

export interface Introspector {
  introspect(options: IntrospectionOptions): Promise<TableSchema[]>;
}

export interface GenerateSchemaOptions extends IntrospectionOptions {
  out: string;
  dialect?: Dialect | undefined;
  check?: boolean | undefined;
}

export type GenerateSchemaResult =
  | { kind: 'written'; warnings?: string[] }
  | { kind: 'upToDate'; warnings?: string[] }
  | { kind: 'drift'; summary: string; warnings?: string[] };
