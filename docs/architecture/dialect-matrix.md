# OwlSQL v1 dialect matrix

OwlSQL keeps raw SQL as the runtime source of truth. The public compiler accepts the supported union of SQL forms and does not receive a dialect parameter. Placeholder-style checks are enforced when a `TypedDb` is branded through an adapter or `createTypedDb` option; the database remains authoritative for dialect validity.

`Yes` means OwlSQL infers the form. `No` means the dialect capability contract marks the form unsupported; it does not imply that dialect-neutral `Query` rejects the spelling.

| Feature | PostgreSQL | MySQL | SQLite | SQL Server | Executable evidence |
| --- | --- | --- | --- | --- | --- |
| SELECT projection, joins, WITH/CTE | Yes | Yes | Yes | Yes | [`dialect-matrix.test-d.ts`](../../tests/compatibility/dialect-matrix.test-d.ts) |
| INSERT, UPDATE, DELETE | Yes | Yes | Yes | Yes | Core DML type suites |
| Dollar placeholders | Yes | No | Yes | No | [`dialect-brand.test-d.ts`](../../packages/core/tests/dialect-brand.test-d.ts) |
| Question placeholders | No | Yes | Yes | No | [`dialect-brand.test-d.ts`](../../packages/core/tests/dialect-brand.test-d.ts) |
| Named `@` placeholders | No | No | Yes | Yes | [`dialect-mssql.test-d.ts`](../../packages/core/tests/dialect-mssql.test-d.ts) |
| Double-quoted identifiers | Yes | No | Yes | No | [`dialect-postgres.test-d.ts`](../../packages/core/tests/dialect-postgres.test-d.ts), [`dialect-sqlite.test-d.ts`](../../packages/core/tests/dialect-sqlite.test-d.ts) |
| Backtick identifiers | No | Yes | Yes | No | [`dialect-mysql.test-d.ts`](../../packages/core/tests/dialect-mysql.test-d.ts) |
| Bracket identifiers | No | No | Yes | Yes | [`dialect-mssql.test-d.ts`](../../packages/core/tests/dialect-mssql.test-d.ts) |
| LIMIT/OFFSET | Yes | Yes | Yes | No | PostgreSQL, MySQL, and SQLite dialect type suites |
| TOP | No | No | No | Yes | [`dialect-mssql.test-d.ts`](../../packages/core/tests/dialect-mssql.test-d.ts) |
| DISTINCT ON | Yes | No | No | No | [`distinct.test-d.ts`](../../packages/core/tests/distinct.test-d.ts) |
| RETURNING | Yes | No | Yes | No | PostgreSQL, MySQL, SQLite, and capability assertions in [`dialect-matrix.test-d.ts`](../../tests/compatibility/dialect-matrix.test-d.ts) |
| OUTPUT | No | No | No | Yes | [`dialect-mssql.test-d.ts`](../../packages/core/tests/dialect-mssql.test-d.ts) |
| MERGE | No | No | No | Yes | [`dialect-mssql.test-d.ts`](../../packages/core/tests/dialect-mssql.test-d.ts) |

The capability interfaces under `packages/core/src/language/dialect/` are the executable source for unsupported cells. Adapter integration tests under `tests/integration/` verify the driver boundary when the corresponding real database is available.
