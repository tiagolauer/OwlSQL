# Changelog

Notable changes to this project, following [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). This log starts at 0.1.8; earlier history lives in git and the GitHub releases page.

## [Unreleased]

### Fixed

- `WITH t AS MATERIALIZED (...)` and its `NOT MATERIALIZED` twin parse again. The parser wanted the body's opening paren directly after `as`, so the Postgres 12 planner hint took the whole WITH clause down with it and the query degraded into an index signature row instead of reporting anything ([#283](https://github.com/tiagolauer/OwlSQL/issues/283)).
- A name that hides a real table now replaces it instead of merging with it. A CTE was only shadowed for the outer query, so a later CTE body still saw the real table's other columns ([#285](https://github.com/tiagolauer/OwlSQL/issues/285)), and a derived table whose alias reused a table name was intersected with it rather than hiding it ([#286](https://github.com/tiagolauer/OwlSQL/issues/286)). Strict mode accepted `select name from (select id from users) users` and typed a column the query cannot produce.
- A raw `%` in an mssql connection URL explains itself instead of dying with a bare `URI malformed`. `new URL` accepts a broken percent sequence, so the throw came out of `decodeURIComponent` afterwards, outside the try/catch built to explain malformed URLs — and passwords with special characters are exactly where a stray `%` shows up ([#306](https://github.com/tiagolauer/OwlSQL/issues/306)).
- `owlsql generate --url "file:///C:/data/app.db"` finds the database on Windows. The RFC 8089 form carries an empty authority, so stripping `file://` left that slash glued to the drive letter and the file was reported missing under `/C:/data/app.db`, a path nobody wrote ([#305](https://github.com/tiagolauer/OwlSQL/issues/305)).
- The CLI no longer echoes a password when a connection URL is malformed in a way the blocklist misses. `jdbc:postgresql://user:pw@host/db` and `postgres//user:pw@host/db` (missing colon) match neither the scheme detector nor the credential patterns, so both fell through to sqlite and the "database file not found" error printed the raw string, password included, into terminal scrollback and CI logs. The echo is redacted at the point it is written, which covers the next gap too ([#278](https://github.com/tiagolauer/OwlSQL/issues/278)).
- `owlsql generate` picks up SQLite generated columns. `PRAGMA table_info` omits them, so a `generated always as (...)` column, VIRTUAL or STORED, was missing from the schema while `select *` returned it — the generated `DB` disagreed with every read, and strict mode and the editor plugin flagged valid queries touching those columns ([#292](https://github.com/tiagolauer/OwlSQL/issues/292)).
- A SQLite `?NNN` placeholder is rejected with an explanation instead of the driver's "column index out of range". The type layer gives `?1` no slot at all, the parameter scanner read it as a bare `?` and pushed a value node:sqlite could not place, and the error that came back pointed nowhere useful. Write a bare `?`, a `$1`, or a `:name` ([#304](https://github.com/tiagolauer/OwlSQL/issues/304)).
- A named placeholder whose name starts with `action` (`$actionType`, `$action_id`, `$actionable`) is checked against the dialect again. MERGE's `$action` pseudo-column was stripped as a substring rather than as a whole token, so those names left no dollar placeholder behind, the query reported no placeholder style at all, and it passed the brand check against a mysql or sqlite client that can never bind a `$name` - while the parameter tuple still demanded a value for it ([#298](https://github.com/tiagolauer/OwlSQL/issues/298)).
- The editor plugin stops flagging every qualified reference to a CTE as an unknown alias. `with recent as (...) select r.id from recent r`, the same reference by the CTE's own name, and the same in a WHERE clause all resolve cleanly in the type layer; the plugin dropped CTE names from its source list and had nothing left to match the qualifier against ([#293](https://github.com/tiagolauer/OwlSQL/issues/293)).
- The editor plugin stops reporting `ambiguous column` on the branches of a set operation. It pooled every FROM/JOIN in the statement into one scope, so the columns a `union` shares - which is all of them, since branches have to be column-compatible - looked like they came from two tables at once, putting a squiggle on nearly every UNION. Diagnostics now cover the first branch, which is also the branch the core takes the row shape from ([#294](https://github.com/tiagolauer/OwlSQL/issues/294)).
- A placeholder reused against columns of different types says so. `where id = $1 or name = $1` intersected `number` with `string`, collapsed the tuple to `[never]` and made every call - including the zero-argument one - fail with an opaque "not assignable to never" chain. The query is still rejected, since pg refuses inconsistent deduced parameter types too, but now as `QueryTypeError<'conflicting types for $1'>` ([#302](https://github.com/tiagolauer/OwlSQL/issues/302)).

## [0.2.0] - 2026-07-29

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

### Fixed

An end-to-end audit of the library, the CLI, and the editor plugin; every entry below was reproduced before it was fixed.

- Placeholders no longer collapse into a single unusable slot. A cast on a numbered placeholder (`$1::int`) now still binds by index, and two distinct `$name` placeholders get a slot each instead of intersecting into `never` ([#228](https://github.com/tiagolauer/OwlSQL/issues/228)).
- `UPDATE`/`DELETE` without a `FROM`/`USING` clause no longer gains a fabricated second source that matched every table in the schema, which made every `RETURNING` column report `ambiguous column` in strict mode ([#229](https://github.com/tiagolauer/OwlSQL/issues/229)).
- `INSERT ... SELECT` is callable again: its parameter tuple resolved to `never`, which rejects every call including the zero-argument one. It now falls back to `unknown[]` as documented ([#230](https://github.com/tiagolauer/OwlSQL/issues/230)).
- `MERGE ... OUTPUT $action` no longer demands an extra argument or fails the placeholder-style check against the mssql executor — `$action` is a pseudo-column, not a placeholder ([#231](https://github.com/tiagolauer/OwlSQL/issues/231)).
- A semicolon inside a quoted identifier (`"id;x"`, `` `id;x` ``, `[id;x]`) is no longer read as a stacked statement ([#232](https://github.com/tiagolauer/OwlSQL/issues/232)).
- Strict mode now validates the `WHERE` clause of an `UPDATE`/`DELETE` written without `RETURNING`, which it previously skipped entirely ([#233](https://github.com/tiagolauer/OwlSQL/issues/233)).
- The mssql and node:sqlite parameter scanners skip SQL comments and quoted identifiers. A `@name`/`$name`/`?` inside a comment was bound as a real parameter, shifting every value after it ([#234](https://github.com/tiagolauer/OwlSQL/issues/234)).
- `createMssqlExecutor(request)` works for more than one query: a caller-supplied `Request` is reset before binding, instead of throwing on a repeated parameter name and leaking the previous query's values ([#235](https://github.com/tiagolauer/OwlSQL/issues/235)).
- `owlsql generate --url file:./app.db` works; the bare `file:` prefix was detected but never stripped ([#236](https://github.com/tiagolauer/OwlSQL/issues/236)).
- The node:sqlite adapter reports write metadata for a CTE-led write (`with ... insert ...`) and for a write with `RETURNING`, both of which previously reported none ([#237](https://github.com/tiagolauer/OwlSQL/issues/237)).
- `:name` placeholders are typed. The adapter has always bound them; the type layer produced an empty parameter tuple and strict mode flagged them as unknown columns ([#238](https://github.com/tiagolauer/OwlSQL/issues/238)).
- The editor plugin no longer loses the joined table in a plain `from a join b`, marking every reference to it as an unknown alias. `JOIN ... USING` and comma-joined `FROM` lists are handled too ([#242](https://github.com/tiagolauer/OwlSQL/issues/242)).

A second pass over the same ground, once those landed, found ten more; same rule, every one reproduced first.

- A placeholder written inside a call gets its parameter slot. `lower($1)`, `coalesce($1, 0)` and `any($1)` were part of one unrecognized token, so the tuple had no slot for a value the driver still demanded and the correct call would not compile ([#244](https://github.com/tiagolauer/OwlSQL/issues/244)).
- `insert into users(id, name) ...` — the column list glued to the target, with no space — no longer reads the table as `users(id,`, which cost the statement both its parameter types and its `RETURNING` columns ([#245](https://github.com/tiagolauer/OwlSQL/issues/245)).
- `UPDATE t alias`, `DELETE FROM t AS alias` and `MERGE INTO t AS alias` keep the alias. Every reference through it reported `unknown alias` in strict mode and resolved to `unknown` without a word outside it ([#246](https://github.com/tiagolauer/OwlSQL/issues/246)).
- A quoted identifier holding a space (`"first name"`, `[Order Details]`) stays in one piece instead of being split at the space — including in schemas `owlsql generate` writes itself, which quotes any name that isn't a plain identifier ([#247](https://github.com/tiagolauer/OwlSQL/issues/247)).
- The mssql and node:sqlite parameter scanners no longer read a backslash before a closing quote as an escape. Neither engine has one, so `'C:\'` is a complete literal in both: SQL Server got a query referencing a parameter that was never declared, and SQLite silently returned the wrong result set ([#248](https://github.com/tiagolauer/OwlSQL/issues/248)).
- Postgres's `@>`, `<@`, `?|` and `?&` are operators, not placeholders. `where tags @> $1` used to demand an extra argument and fail the placeholder-style check against a dollar executor ([#249](https://github.com/tiagolauer/OwlSQL/issues/249)).
- The editor plugin resolves table and column names case-insensitively, the way the type layer always has. `select id from USERS` type-checked fine and still drew a warning ([#250](https://github.com/tiagolauer/OwlSQL/issues/250)).
- A password containing an unencoded `@` (`mysql://root:p@ss@host/db`, which every driver accepts) is redacted whole. The pattern stopped at the first `@` and printed the rest of the password ([#251](https://github.com/tiagolauer/OwlSQL/issues/251)).
- A query holding two different kinds of whitespace no longer takes the compiler down with it. A tab beside a newline, or a single CRLF pair, exhausted the heap and killed the whole `tsc` run, so a tab-indented multi-line query or a checkout with CRLF endings could not be compiled at all ([#266](https://github.com/tiagolauer/OwlSQL/issues/266)).
- Strict mode reads the right WHERE on an UPDATE whose SET list holds a subquery. It took the first `where` in the string, so the subquery's columns were checked against the outer target and the statement's own WHERE was never checked at all: `update users set name = (select name from orders where total > 5) where id = 2` was rejected, and a typo in the real clause passed ([#280](https://github.com/tiagolauer/OwlSQL/issues/280)).
- The node:sqlite adapter binds `$1` by its number again. It read a numbered placeholder as a name that happened to be a digit and handed out values in the order the placeholders were written, so `where name = $2 and id = $1` bound them backwards: the same typed call returned the right rows on pg and the wrong ones on SQLite, and a write stored the swapped values without any error ([#267](https://github.com/tiagolauer/OwlSQL/issues/267)).
- A parenthesized branch of a set operation parses again. `(select id from users) union (select id from archived_users)` opens with `(` rather than a keyword, which the statement parser matched to nothing, and the row came back as a bare index signature instead of failing; wrapping branches in parentheses is how a set operation gives one its own ORDER BY or LIMIT ([#275](https://github.com/tiagolauer/OwlSQL/issues/275)).
- A set-operation branch written without a `FROM` clause no longer swallows the branch after it. Only `FROM` ended the column list, so `select 1 union select 2` came back keyed `'union select 2'`, and the recursive counter every `WITH RECURSIVE` tutorial opens with typed its column as `unknown` ([#274](https://github.com/tiagolauer/OwlSQL/issues/274)).

### Added

- `owlsql generate` accepts a SQL Server named instance in the URL form (`mssql://user:pass@host\INSTANCE/db`), and explains what a valid connection string looks like when the URL cannot be parsed at all ([#239](https://github.com/tiagolauer/OwlSQL/issues/239)).
- `owlsql generate` rejects a `--table` name that matches no table instead of silently generating a schema without it, and warns on an unmatched `--exclude` ([#240](https://github.com/tiagolauer/OwlSQL/issues/240)). Boolean flags now reject a value, so `--check=false` no longer turned the check on ([#241](https://github.com/tiagolauer/OwlSQL/issues/241)).
- `= any($1)` and `= all($1)` type their parameter as an array of the column's type, and `@>`/`<@` join the `WHERE` operators whose right-hand value is typed from the column ([#244](https://github.com/tiagolauer/OwlSQL/issues/244), [#249](https://github.com/tiagolauer/OwlSQL/issues/249)).
- `owlsql generate` maps a SQLite `JSON` column to `string` and an unrecognized declared type to `unknown`, instead of calling both `number` ([#252](https://github.com/tiagolauer/OwlSQL/issues/252)). An empty `--table`/`--exclude` list is now an error rather than a silently dropped filter ([#253](https://github.com/tiagolauer/OwlSQL/issues/253)).
- Integration tests running the adapters and `owlsql generate` against real PostgreSQL, MySQL, and SQL Server instances, alongside the existing faked-driver tests.
- A type-instantiation budget (`npm run test:perf`) that fails CI when a change makes the type-level parser measurably more expensive. Its ceiling moved from 185,000 to 195,000 for [#247](https://github.com/tiagolauer/OwlSQL/issues/247): telling whether a query quotes anything means scanning it, so supporting quoted names with spaces costs roughly 4% on every query.
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
