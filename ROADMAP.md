# Roadmap

Where OwlSQL is headed, and where it's already been. This is a
living document — it reflects the current state of the type-level parser and
the editor tooling, not a promise of dates.

## Shipped

- Core parser: `SELECT`/`INSERT`/`UPDATE`/`DELETE`, joins (`INNER`/`LEFT`/
  `RIGHT`/`FULL`/`CROSS`), aliases, `*`/qualified star, aggregates/functions,
  `RETURNING`, strict mode, typed parameters.
- `WHERE` operators (`LIKE`/`IN`/`BETWEEN`/`IS NULL`/`AND`/`OR`), `GROUP BY`/
  `HAVING`/`ORDER BY`/`LIMIT`/`OFFSET`, `UNION`/`UNION ALL`, `CASE`, window
  functions, CTEs (`WITH`), derived-table subqueries in `FROM`.
- Official multi-database support: PostgreSQL, MySQL, SQLite, SQL Server
  (named `@params`, backtick identifiers, `TOP`, `OUTPUT`).
- Ready-made driver adapters (`pg`, `mysql2`, `postgres.js`, `node:sqlite`,
  Kysely) and a documented Drizzle recipe.
- `npx @owlsql/core generate` — schema introspection CLI for all four
  databases.
- `@owlsql/ts-plugin` — in-editor column-name autocomplete and hover
  info, `JOIN`/alias-aware, plus live diagnostics for unknown columns,
  unknown tables, unknown aliases, and ambiguous unqualified columns in the
  `SELECT` list and `FROM`/`JOIN` clause. Ships as its own package on its own
  version, since it reaches a narrower TypeScript range than the library.
- Scalar subqueries in the `SELECT` list — single-column subqueries are
  typed; a multi-column subquery resolves to `unknown` in normal mode and a
  `QueryTypeError` in strict mode (selecting more than one column from a
  scalar subquery is invalid SQL). See [README limitations](README.md#limitations).
- Typed params inside a `WITH` CTE's own body — a placeholder in a CTE's
  own definition is typed against that CTE's own `FROM` source, in textual
  order alongside `INSERT ... VALUES` params and params in the outer query
  referencing a CTE by name.
- Nested `CASE` — a `CASE` nested inside another `CASE`'s `WHEN`/`THEN`/
  `ELSE` branch is parsed and typed like any other branch expression.
- [COMPARISON.md](COMPARISON.md) — sourced comparison vs Prisma/Kysely/
  pgTyped/Zapatos on build step, runtime cost, bundle size, and DX.

## In progress / help wanted

Bigger pieces that need real parser or compiler-API design work — not
first-timer-sized, but open if you want to dig in:

- **Scalar subqueries in `WHERE`** still resolve to `unknown` — `WHERE`
  isn't part of the typed structure at all right now, only scanned for
  parameter placeholders.
- **`@owlsql/ts-plugin` on TypeScript 7+** — TypeScript 7.0 shipped in July
  2026 and is now the `latest` tag on npm. It carries no public compiler API
  at all: the classic `ts.Node`/`ts.forEachChild`/`ts.createProgram` surface
  is gone, and the `tsserver` protocol that loads plugins has been replaced
  by LSP. This isn't unique to this project — it takes out every editor
  plugin built the classic way. TypeScript 7.1 is expected to introduce a
  new, different programmatic API; reaching it will be a rewrite rather than
  a port, so the plugin waits for that API to exist before anyone starts.
  The library itself is unaffected — it needs no compiler API and is tested
  against TypeScript 7 in CI, which is why the plugin was split into its own
  package rather than holding `@owlsql/core` to a narrower range.

## Good first issues

Small, self-contained gaps — see issues labeled
[`good first issue`](https://github.com/tiagolauer/OwlSQL/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22)
on GitHub. Each one names the exact file and the pattern to follow from
neighboring code, so you don't need to understand the whole parser to land
one.

## Not planned

- A query builder API. The whole point is writing SQL directly — a builder
  API would duplicate what Kysely already does well (see
  [COMPARISON.md](COMPARISON.md)).
- Migrations. Out of scope; use a dedicated migration tool alongside this
  library.
- Runtime SQL execution or a bundled driver. The library only infers types;
  you always bring your own driver/executor.
