import type { ColumnSchema, TableSchema } from './types.js';

const VALID_IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

function renderKey(name: string): string {
  return VALID_IDENTIFIER.test(name) ? name : JSON.stringify(name);
}

function renderColumn(column: ColumnSchema): string {
  const type = column.nullable ? `${column.tsType} | null` : column.tsType;
  return `    ${renderKey(column.name)}: ${type};`;
}

function renderTable(table: TableSchema): string {
  const columns = table.columns.map(renderColumn).join('\n');
  return `  ${renderKey(table.name)}: {\n${columns}\n  };`;
}

export function renderSchema(tables: TableSchema[]): string {
  const body = tables.map(renderTable).join('\n');
  return `export interface DB {\n${body}\n}\n`;
}
