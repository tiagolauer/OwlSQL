import type * as ts from 'typescript';

// SQL identifiers are matched case-insensitively by the type layer
// (ResolveKey/CaseInsensitiveKey in src/parse.ts), so the plugin has to
// resolve them the same way or it reports a warning on a query tsc types
// perfectly - `select id from USERS` against a `users` table (issue #250).
// The exact lookup runs first: it is the cheap path and the common one.
function findPropertySymbol(
  checker: ts.TypeChecker,
  type: ts.Type,
  name: string,
): ts.Symbol | undefined {
  const exact = checker.getPropertyOfType(type, name);
  if (exact) {
    return exact;
  }

  const lowered = name.toLowerCase();
  return type.getProperties().find((symbol) => symbol.getName().toLowerCase() === lowered);
}

function scopeToTable(
  tableSymbols: ts.Symbol[],
  onlyTable: string | string[] | null,
): ts.Symbol[] {
  if (!onlyTable) {
    return tableSymbols;
  }

  const wanted = new Set(
    (Array.isArray(onlyTable) ? onlyTable : [onlyTable]).map((name) => name.toLowerCase()),
  );
  return tableSymbols.filter((symbol) => wanted.has(symbol.getName().toLowerCase()));
}

function tableExists(
  typescript: typeof ts,
  checker: ts.TypeChecker,
  dbType: ts.Type,
  tableName: string,
): boolean {
  if (findPropertySymbol(checker, dbType, tableName)) {
    return true;
  }
  // A Record<string, ...>-shaped schema (this library's own documented
  // Schema type, src/parse.ts) has no per-table property to look up - every
  // string key is a valid table, resolved through the index signature
  // instead, the same way the type-level parser indexes DB[Table] directly.
  return checker.getIndexInfoOfType(dbType, typescript.IndexKind.String) !== undefined;
}

// Resolve the row type(s) a table scope points at, tolerating the two DB
// shapes getProperties() alone can't see through: an optional table key
// (`users?: {...}` types the property as `{...} | undefined`, so its
// properties are stripped to non-nullable) and a Record<string, ...> schema
// with no per-table property to enumerate at all, in which case every
// requested name falls back to the schema's string index type.
function resolveTableRowTypes(
  typescript: typeof ts,
  checker: ts.TypeChecker,
  dbType: ts.Type,
  node: ts.Node,
  onlyTable: string | string[] | null,
): ts.Type[] {
  const tableSymbols = scopeToTable(dbType.getProperties(), onlyTable);
  const resolvedNames = new Set(tableSymbols.map((symbol) => symbol.getName().toLowerCase()));
  const rowTypes = tableSymbols.map((symbol) =>
    checker.getNonNullableType(checker.getTypeOfSymbolAtLocation(symbol, node)),
  );

  if (!onlyTable) {
    return rowTypes;
  }

  const indexType = checker.getIndexInfoOfType(dbType, typescript.IndexKind.String)?.type;
  if (!indexType) {
    return rowTypes;
  }

  const requestedNames = Array.isArray(onlyTable) ? onlyTable : [onlyTable];
  for (const name of requestedNames) {
    if (!resolvedNames.has(name.toLowerCase())) {
      rowTypes.push(indexType);
    }
  }

  return rowTypes;
}

function resolveColumnType(
  typescript: typeof ts,
  checker: ts.TypeChecker,
  rowType: ts.Type,
  node: ts.Node,
  columnName: string,
): ts.Type | null {
  const columnSymbol = findPropertySymbol(checker, rowType, columnName);
  if (columnSymbol) {
    return checker.getTypeOfSymbolAtLocation(columnSymbol, node);
  }

  return checker.getIndexInfoOfType(rowType, typescript.IndexKind.String)?.type ?? null;
}

// Whether a column reference is valid for a table, independent of whether
// getColumnNames can actually enumerate it: a Record<string, ...> row type
// has no named properties to list (there's no fixed name list to offer as
// completions), but any string key still resolves through its index
// signature, so it must not be flagged as an unknown column.
function columnExists(
  typescript: typeof ts,
  checker: ts.TypeChecker,
  dbType: ts.Type,
  node: ts.Node,
  table: string,
  columnName: string,
): boolean {
  const rowTypes = resolveTableRowTypes(typescript, checker, dbType, node, table);
  return rowTypes.some(
    (rowType) => resolveColumnType(typescript, checker, rowType, node, columnName) !== null,
  );
}

function getColumnNames(
  typescript: typeof ts,
  checker: ts.TypeChecker,
  dbType: ts.Type,
  node: ts.Node,
  onlyTable: string | string[] | null,
): string[] {
  const rowTypes = resolveTableRowTypes(typescript, checker, dbType, node, onlyTable);
  const columnNames = new Set<string>();

  for (const rowType of rowTypes) {
    for (const columnSymbol of rowType.getProperties()) {
      columnNames.add(columnSymbol.getName());
    }
  }

  return [...columnNames];
}

function getColumnType(
  typescript: typeof ts,
  checker: ts.TypeChecker,
  dbType: ts.Type,
  node: ts.Node,
  onlyTable: string | string[] | null,
  columnName: string,
): ts.Type | null {
  const rowTypes = resolveTableRowTypes(typescript, checker, dbType, node, onlyTable);
  const matches = rowTypes
    .map((rowType) => resolveColumnType(typescript, checker, rowType, node, columnName))
    .filter((type): type is ts.Type => type !== null);

  if (matches.length === 0) {
    return null;
  }

  const [first, ...rest] = matches;
  const firstText = checker.typeToString(first as ts.Type);
  const isUnambiguous = rest.every((type) => checker.typeToString(type) === firstText);

  return isUnambiguous ? (first as ts.Type) : null;
}

export = { getColumnNames, getColumnType, tableExists, columnExists };
