# Changelog

Notable changes to this project, following [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). This log starts at 0.1.8; earlier history lives in git and the GitHub releases page.

## [Unreleased]

### Changed

- **Breaking:** the editor plugin moved out of this package into its own, [`@owlsql/ts-plugin`](ts-plugin/README.md). The `@owlsql/core/ts-plugin` subpath is gone. To migrate, install `@owlsql/ts-plugin` as a dev dependency and change the plugin name in your `tsconfig.json`:

  ```json
  {
    "compilerOptions": {
      "plugins": [{ "name": "@owlsql/ts-plugin" }]
    }
  }
  ```

  Nothing about what the plugin does changed. The split exists because the two halves reach different TypeScript versions: the library type-checks clean on TypeScript 7, while the plugin needs the classic compiler API that TypeScript 7 removed. A single package can only declare one peer range, and either choice would have misrepresented half the code.

### Added

- Integration tests running the adapters and `owlsql generate` against real PostgreSQL, MySQL, and SQL Server instances, alongside the existing faked-driver tests.
- A type-instantiation budget (`npm run test:perf`) that fails CI when a change makes the type-level parser measurably more expensive.
- [VERSIONING.md](VERSIONING.md), stating what counts as a breaking change for a library whose public API is the types it infers.
- CI now type-checks the library against TypeScript 7, which the `peerDependencies` range already claimed to support.

## [0.1.8] - 2026-07-24

### Added

- `MERGE` statement support for SQL Server: types the target table and the `OUTPUT` clause, including the `$action` pseudo-column.
- Per-adapter transaction helpers (`createPgTransaction`, `createMysql2Transaction`, `createPostgresJsTransaction`, `createMssqlTransaction`) that pin a single connection and handle begin/commit/rollback for you.
- Editor diagnostics for simple `WHERE`-clause column references: unknown column, unknown table, unknown alias, ambiguous column.
- Table-name completions after `FROM`/`JOIN` in the editor plugin.
- `owlsql generate --check` for catching schema drift in CI without writing the file.

### Fixed

- `UPDATE ... FROM` and `DELETE ... USING` now register the extra table as a source instead of ignoring it.
- Postgres array columns map to more accurate JS types instead of assuming every array becomes `T[]`.
- SQLite `BLOB` columns map to `Uint8Array`, matching what `node:sqlite` actually returns.
- The `pg`, `postgres.js`, and `mysql2` adapters all normalize `undefined` parameters to `null` the same way.
- Corrected the Kysely adapter docs: placeholder-style checking already works there, it just needs `{ placeholders: ... }` passed explicitly.
- Editor plugin no longer treats a backslash-escaped quote (`\'`) as the end of a string literal.
- Editor plugin schema lookups now handle optional table keys and `Record<string, ...>` schemas.
- Editor plugin detects `TypedDb` even when it's wrapped in an interface or a generic type parameter.
- Nested `CASE` expressions wrapped in parentheses parse correctly.
- Function call output columns keep the casing you wrote instead of being lowercased.
- `JOIN LATERAL` subqueries resolve correctly instead of being misread.
- A CTE that reuses a real table's name now shadows it instead of leaking the original table's columns.
- Editor plugin recognizes `WITH` queries instead of losing completions for the whole statement.
- Documented that `count`/`sum`/`avg` come back as strings from `pg` by default, the same caveat already noted for `min`/`max`.
