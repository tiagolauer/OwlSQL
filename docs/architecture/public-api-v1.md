# OwlSQL v1 public API

This inventory records the supported `@owlsql/core` surface after building and inspecting `dist/index.d.ts` and `package.json#exports`.

## Root export

`@owlsql/core` exports these runtime values:

- `createTypedDb`
- `defineSchema`
- `QueryErrorKind`
- `ResultStatus`
- `ok`
- `err`
- `isOk`
- `isErr`

It exports these types:

- `Query`, `Row`, `StrictQuery`, `StrictRow`, `Params`
- `InferResult`, `InferRow`, `InferResultStrict`, `InferRowStrict`, `InferParams`
- `Schema`, `SchemaLike`, `QueryTypeError`
- `Executor`, `ExecutorResult`, `DialectExecutor`, `PlaceholderStyle`
- `QueryError`, `TypedDb`, `TypedDbOptions`
- `Result`, `Ok`, `Err`, `QueryMeta`

## Adapter subpaths

| Subpath | Public exports |
| --- | --- |
| `@owlsql/core/pg` | `createPgExecutor`, `createPgTransaction`, `PgQueryable` |
| `@owlsql/core/mysql2` | `createMysql2Executor`, `createMysql2Transaction`, `Mysql2Queryable` |
| `@owlsql/core/postgres` | `createPostgresJsExecutor`, `createPostgresJsTransaction` |
| `@owlsql/core/node-sqlite` | `createNodeSqliteExecutor` |
| `@owlsql/core/mssql` | `createMssqlExecutor`, `createMssqlTransaction`, `MssqlQueryable` |
| `@owlsql/core/kysely` | `createKyselyExecutor` |

The package also exposes the `owlsql` binary from `dist/cli/index.js`.

## Removed before 1.0

`ParseSelect`, `ParseStatement`, `ParsedStatement`, `Source`, and `FunctionReturnTypes` were accidental compiler-internal exports. They are removed without replacement. Language IR, compiler contracts, schema generation internals, and tooling modules are not public package subpaths.
