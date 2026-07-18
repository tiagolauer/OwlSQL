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

export interface ConnectionInfo {
  url: string;
  schema?: string | undefined;
}
