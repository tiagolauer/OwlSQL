# OwlSQL

> Write raw SQL. Get fully-typed results. No codegen, no ORM, no runtime parsing.

OwlSQL (`@owlsql/core`) reads your SQL inside TypeScript's type system and
infers the row shape from the query string and your schema. It happens as you
type, in your editor. There is no build step.

```ts
type DB = {
  users: { id: number; name: string; email: string; active: boolean };
};

const db = createTypedDb<DB>(createPgExecutor(pool));

const a = await db.query('select id from users');
//        a.value ^? { id: number }[]

const b = await db.query('select name as handle, active from users');
//        b.value ^? { handle: string; active: boolean }[]

const c = await db.query('select * from users');
//        c.value ^? { id: number; name: string; email: string; active: boolean }[]

const d = await db.query('select id from users where id = $1', 7);
//                                                             ^ typed as number
```

Rename a column in the SQL, mistype a field, or select something that does not
exist, and the result type changes immediately, before you run a single line.
There is **no generated file to keep in sync** and **no SQL parser shipped to
production**: all the work happens during type checking.

It is **not** an ORM and **not** a query builder. It does not connect to your
database. You keep writing the SQL you already know; this library only layers
compile-time result typing on top of whatever driver you use.

**[Try it in your browser →](https://stackblitz.com/github/tiagolauer/OwlSQL/tree/master/examples/playground?file=index.ts)**
No install, no database — see [`examples/playground`](examples/playground).

---

## Table of contents

- [The problem](#the-problem)
- [How it works](#how-it-works)
- [Install](#install)
- [How it compares](#how-it-compares)
- [What it costs to compile](#what-it-costs-to-compile)
- [Tutorial](#tutorial)
  - [1. Describe your schema](#1-describe-your-schema)
  - [2. Create a typed client](#2-create-a-typed-client)
  - [3. Run queries and handle the Result](#3-run-queries-and-handle-the-result)
  - [4. Aliases, `*`, and qualified columns](#4-aliases--and-qualified-columns)
  - [5. Type-only usage (no client)](#5-type-only-usage-no-client)
  - [6. Aggregates and functions](#6-aggregates-and-functions)
  - [7. INSERT / UPDATE / DELETE with RETURNING](#7-insert--update--delete-with-returning)
  - [8. Strict mode — turn typos into type errors](#8-strict-mode--turn-typos-into-type-errors)
  - [9. Joins](#9-joins)
  - [10. Typed parameters](#10-typed-parameters)
  - [11. Transactions](#11-transactions)
- [Driver recipes](#driver-recipes)
- [Database support](#database-support)
- [Editor autocomplete](#editor-autocomplete)
- [API reference](#api-reference)
- [Supported SQL subset](#supported-sql-subset)
- [Limitations](#limitations)
- [FAQ](#faq)
- [Contributing](#contributing)
- [License](#license)

---

## The problem

I was building a TypeScript backend and picked raw SQL over an ORM on purpose.
I wanted control over the queries and no layer of magic between my code and the
database. That part worked.

The return types were the problem. Every query came back as `any[]` or
`unknown[]`, so I wrote an interface by hand for each one:

```ts
interface UserListRow { id: number; name: string }
const rows = (await pool.query('select id, name from users')).rows as UserListRow[];
```

Those interfaces drift. Someone adds `email` to the SQL, forgets the interface,
and the type quietly lies until it breaks in production. They are also
boilerplate: the interface restates the query in a second syntax, so you type
the same column list twice.

The usual fixes each cost something. ORMs replace your SQL with their own DSL
and runtime, which was the thing I was trying to avoid. Codegen tools do give
you accurate types, but they bolt a generation step onto the build, so now you
have a watcher, a CLI, a database connection at build time, and generated files
in version control.

The query string is already the source of truth, so the compiler may as well
read it. TypeScript's template literal types can parse a `SELECT` and map its
columns to a schema during type checking, which is what this library does.

## How it works

There is no runtime SQL parser and no build step. The entire parser is written
as recursive [template literal types](https://www.typescriptlang.org/docs/handbook/2/template-literal-types.html)
evaluated by `tsc`:

1. **Normalize** — collapse newlines, tabs, and runs of spaces into a single
   trimmed, single-spaced string.
2. **Parse** — strip the `SELECT` keyword, split on the first case-insensitive
   `FROM`, and separate the column list from the table name.
3. **Resolve** — parse each column into `[outputName, sourceColumn]` (handling
   `AS` aliases and `table.col` qualifiers), then look the column up in your
   schema to get its TypeScript type.
4. **Assemble** — build `{ ...columns }[]`.

The JavaScript that actually ships is a tiny passthrough: it forwards your SQL
to the driver you provide and wraps the rows in a `Result`. All the intelligence
lives in the `.d.ts` types.

## Install

```bash
npm install @owlsql/core
```

`typescript` is a peer dependency (**>= 5.0, < 8** — template literal type
recursion needs 5.0; the ts-plugin does not load on TS 7). You almost
certainly already have it.

The package is **ESM-only** (`import` only — `require()` is not supported).
Node support: **>= 20** for the library and CLI; the `node:sqlite` adapter
and the CLI's SQLite introspection additionally need **Node >= 22.5** (they
fail with a clear error below that).

## How it compares

| | OwlSQL | Prisma | Kysely | pgTyped | Zapatos |
| --- | --- | --- | --- | --- | --- |
| You write | Raw SQL strings | Prisma's own query API | Builder method chains | Raw SQL in `.sql` files or tags | Helpers, or raw SQL via `db.sql` |
| Build step | No (opt-in `generate` for the schema only) | Yes, `prisma generate` | No (optional `kysely-codegen`) | Yes, a CLI run against a live database | No (opt-in schema generation) |
| Runtime query engine | None. Your string reaches the driver unchanged | Yes, a TypeScript query compiler | Yes, compiles the chain to SQL on every call | Minimal. Runs a query the CLI already extracted | Yes, builds SQL from helper calls |
| Bundle (min/gzip) | No dependencies; ~175 lines of glue, the parser costs 0 bytes | ~1.6 MB / ~600 KB | 189 KB / 38.7 KB | 399 KB / 85 KB | No bundled engine beyond thin helpers |

Kysely is the closest of these in spirit: no magic, and inference that goes all
the way down. What differs is what you type. Its builder is a fluent API; here
you type SQL. If you want to paste a query straight out of `psql` or a
migration file and have it work, that is raw SQL, and that is the premise.

This is not a runtime-speed comparison, on purpose. Your database and driver
dominate query execution, not the layer sitting on top of them, and these five
tools have architectures too different for a queries-per-second figure to say
anything. [COMPARISON.md](COMPARISON.md) has the long version, every number
sourced.

## What it costs to compile

Every tool in that table charges you something. Codegen tools charge a build
step, ORMs charge bundle size and a runtime engine, and this one charges
compile time. So here is the number.

A fixture of 100 tables with 13 columns each, plus 32 queries covering joins,
`GROUP BY`, `CASE`, CTEs, `UNION`, strict mode and typed parameters,
type-checks in:

| | |
| --- | --- |
| Type instantiations | 166,512 |
| Check time | ~0.4s |
| Runtime cost | 0. Nothing parses SQL at request time |

Measured with `tsc --extendedDiagnostics` on TypeScript 5.9.3. The cost grows
linearly on top of a fixed overhead: about 96,000 instantiations go to the
schema itself, then roughly 2,200 per query. CI holds that number to a ceiling,
so a change that makes the parser work harder for the same answer fails the
build instead of quietly slowing down every editor that opens your project.

## Tutorial

### 1. Describe your schema

A schema is just a type: table name → column name → TypeScript type. Use a
`type` or an `interface`, whichever you prefer.

```ts
type DB = {
  users: {
    id: number;
    name: string;
    email: string;
    active: boolean;
  };
  posts: {
    id: number;
    title: string;
    user_id: number;
    published: boolean;
  };
};
```

This type is the single source of truth for what your tables look like. It has
no runtime cost — it is erased during compilation. Mark nullable columns with
`| null` (e.g. `bio: string | null`) and that nullability flows straight into
your query results.

**Optional: generate a starting point with `owlsql generate`.**
Writing that type by hand is fine for a handful of tables, but you can also
have it generated from a real database:

```
npx @owlsql/core generate --url postgres://user:pass@host/db --out schema.ts
```

This connects to your database, introspects the tables/columns/nullability,
and writes a `schema.ts` with `export interface DB { ... }` — the exact shape
from step 1 above. It's a **one-shot generator, not a codegen pipeline**: the
library still parses your queries entirely at the type level with zero
runtime codegen, same as always. The generated file is a normal `.ts` file —
commit it, edit it by hand afterward, rename fields, anything. Running
`generate` again just overwrites it with a fresh snapshot; nothing stays
"synced" automatically — unless you opt into checking for that in CI with
`--check` (below).

| Flag | Required | Description |
| ---- | -------- | ----------- |
| `--url` | yes | Connection string (or a file path for SQLite). SQL Server accepts both `mssql://user:pass@host:1433/db` (translated to a driver config; `?encrypt=false` and `?trustServerCertificate=true` supported, and a named instance may be written as `host\INSTANCE`) and an ADO string (`Server=host;Database=db;User Id=u;Password=p`). |
| `--out` | no | Output file. Defaults to `./schema.ts`. |
| `--dialect` | no | `postgres` \| `mysql` \| `sqlite` \| `mssql`. Auto-detected from the URL scheme (`postgres://`/`postgresql://`, `mysql://`, `mssql://`/`sqlserver://`); an ADO `Server=...` string also routes to `mssql` — falls back to `sqlite` for a bare file path, so it's only needed when that's ambiguous. |
| `--schema` | no | Schema/database name to introspect. Defaults to `public` (Postgres), the connected database (MySQL), or `dbo` (SQL Server). Not used for SQLite. |
| `--table` | no | Comma-separated list (`--table users,posts`). Only introspect these tables, instead of every table in the schema. |
| `--exclude` | no | Comma-separated list. Skip these tables even if `--table` would otherwise include them. |
| `--check` | no | Don't write `--out` — introspect and render as usual, then compare against the existing file. Exits `0` with no output if they match, `1` with a message telling you where they first differ (or that the file doesn't exist yet) if they don't. `--table`/`--exclude`/`--schema` apply identically, so the comparison stays meaningful. Useful in CI to catch a migration that ran without anyone regenerating the committed schema. |

```bash
# CI: fail the build if schema.ts has drifted from the real database
npx @owlsql/core generate --url "$DATABASE_URL" --out schema.ts --check
```

`generate` needs the matching driver installed as a real dependency (`pg`,
`mysql2`, or `mssql` — SQLite uses the `node:sqlite` builtin, Node ≥22.5). It
prints a clear error telling you which one to install if it's missing.

**Type mapping follows each driver's defaults.** `pg` hands back `bigint`,
`numeric`/`decimal` and `money` as `string`; `mysql2` returns `decimal` as
`string` but `bigint` as a JS `number` (unless you enable
`supportBigNumbers`/`bigNumberStrings`); `mssql` (tedious) returns `bigint` as
`string` but parses `decimal`/`numeric`/`money` into JS `number` (with
precision loss beyond 2^53). SQLite has no column types, only affinities, so
the *declared* type drives the mapping: `INTEGER`/`REAL` and the numeric
names (`NUMERIC`, `DECIMAL(10,2)`, `MONEY`) become `number`, text-affinity
types and `JSON` become `string`, `BLOB` and an untyped column become
`Uint8Array`, and a declared type that says nothing about its contents
(`GEOMETRY`, a custom name) becomes `unknown` rather than a guess. The
generated types mirror exactly that. If your driver is configured
differently, just edit the generated field by hand; it's a plain type after
that point.

### 2. Create a typed client

The library never touches your database. You hand `createTypedDb` an
**executor**: a function that takes `(sql, params)`, runs it against your real
driver, and returns the raw rows.

```ts
import { Pool } from 'pg';
import { createTypedDb } from '@owlsql/core';

const pool = new Pool();

const db = createTypedDb<DB>(async (sql, params) => {
  const res = await pool.query(sql, params as unknown[]);
  return res.rows;
});
```

`db` is now bound to your schema. Every query you run through it will be typed
against `DB`.

### 3. Run queries and handle the Result

`query` does not throw on failure. It returns a **`Result`** — a discriminated
union of success or error — so failures are values you handle explicitly.

```ts
import { ResultStatus } from '@owlsql/core';

const result = await db.query('select id, name from users');

if (result.status === ResultStatus.Error) {
  console.error(result.error.kind, result.error.message);
  return;
}

result.value;
//     ^? { id: number; name: string }[]
for (const user of result.value) {
  console.log(user.id, user.name);
}
```

Prefer a helper over the `status` field? `isOk` / `isErr` narrow the same way:

```ts
import { isOk } from '@owlsql/core';

const result = await db.query('select id, email from users');

if (isOk(result)) {
  result.value;
  //     ^? { id: number; email: string }[]
}
```

> ⚠️ **Pass the SQL as a string literal**, not a `string` variable. If the type
> widens to `string`, the compiler can no longer see the query and inference
> falls back to `unknown`. `db.query('select id from users')` ✅ —
> `const q: string = ...; db.query(q)` ❌.

### 4. Aliases, `*`, and qualified columns

```ts
const renamed = await db.query('select id, name as username from users');
//     renamed.value ^? { id: number; username: string }[]

const implicit = await db.query('select name handle from users');
//     implicit.value ^? { handle: string }[]

const qualified = await db.query('select u.id, u.name from users u');
//     qualified.value ^? { id: number; name: string }[]

const everything = await db.query('select * from users');
//     everything.value ^? { id: number; name: string; email: string; active: boolean }[]
```

Trailing clauses are ignored for inference — they do not change the row shape:

```ts
const recent = await db.query(
  'select id, title from posts where published = true order by id limit 10',
);
//     recent.value ^? { id: number; title: string }[]
```

Keywords are case-insensitive and whitespace/newlines are tolerated, so
formatted multi-line queries work as-is:

```ts
const r = await db.query(`
  SELECT id,
         title
  FROM   posts
  WHERE  published = true
`);
//     r.value ^? { id: number; title: string }[]
```

### 5. Type-only usage (no client)

Sometimes you only want the *type* of a query — for an API contract, a DTO, or a
function signature — without running anything. Use the `Query` type directly:

```ts
import type { Query } from '@owlsql/core';

type UserListRow = Query<DB, 'select id, email from users'>;
//   ^? { id: number; email: string }[]

function renderUsers(rows: Query<DB, 'select id, name from users'>) {
  // rows is { id: number; name: string }[]
}
```

`Row<DB, Q>` gives the single-row object (without the surrounding array) if you
need it.

### 6. Aggregates and functions

Common SQL functions resolve to their return type, and the output column is
named after the function (or its alias):

```ts
const stats = await db.query('select count(*) from users');
//     stats.value ^? { count: number }[]

const named = await db.query('select count(*) as total, max(age) as oldest from users');
//     named.value ^? { total: number; oldest: number }[]

const shout = await db.query('select id, upper(name) as name from users');
//     shout.value ^? { id: number; name: string }[]
```

Recognized: `count`, `sum`, `avg`, `min`, `max`, `length`, `char_length`,
`octet_length`, `abs`, `ceil`, `floor`, `round`, `power`, `mod`, `greatest`,
`least`, `row_number`, `rank`, `dense_rank`, `ntile`, `percent_rank`,
`cume_dist` → `number`; `lower`, `upper`, `trim`, `ltrim`, `rtrim`, `concat` →
`string`; `coalesce`, `nullif`, `lag`, `lead`, `first_value`, `last_value`,
`nth_value` → `unknown`; `now`, `current_timestamp`, `current_date` → `Date`.
Anything else resolves to `unknown`. This return-type table is
dialect-agnostic, which isn't always what the driver actually hands back for
`count`/`sum`/`avg` — see [Limitations](#limitations).

### 7. INSERT / UPDATE / DELETE with RETURNING

`RETURNING` is typed exactly like a `SELECT` projection against the target
table:

```ts
const created = await db.query(
  'insert into users (name, email) values ($1, $2) returning id, name',
);
//     created.value ^? { id: number; name: string }[]

const updated = await db.query('update users set active = $1 where id = $2 returning *');
//     updated.value ^? { id: number; name: string; email: string; active: boolean }[]
```

A write without `RETURNING` resolves to `Record<string, never>[]` (no row
columns).

### 8. Strict mode — turn typos into type errors

By default an unknown column or table resolves to `unknown` (permissive). Pass
`{ strict: true }` and the result instead becomes a `QueryTypeError` carrying a
human-readable message, so a typo is impossible to ignore:

```ts
const db = createTypedDb<DB, { strict: true }>(executor, { strict: true });

const ok = await db.query('select id, name from users');
//     ok.value ^? { id: number; name: string }[]

const typo = await db.query('select naem from users');
//     typo.value ^? QueryTypeError<'unknown column: naem'>[]
```

The error type propagates wherever you use the rows, surfacing the message in
hovers and breaking any code that treats them as real data.

Strict mode checks the `SELECT` list, the `WHERE` clause, and `JOIN ... ON`
conditions — including the `WHERE` of an `UPDATE`/`DELETE` that returns no
columns, where a typo is most expensive:

```ts
const wrongSide = await db.query(
  'select u.id from users u join orders o on u.id = o.id',
);
//     wrongSide.value ^? QueryTypeError<'unknown column: id'>[] (when orders has no such column)
```

`GROUP BY`, `HAVING`, and `ORDER BY` are **not** checked — they have their own
resolution rules (a `SELECT`-list alias, an ordinal, an aggregate), so a name
there is not necessarily a column of a source table.

### 9. Joins

`INNER`, `LEFT`, `RIGHT`, `FULL` (with optional `OUTER`), and `CROSS` joins are
supported, with table aliases and any number of joins. Qualified columns
(`alias.column`) resolve to the aliased table; unqualified columns are searched
across every joined table. `alias.*` expands one table; a bare `*` expands all.

```ts
const rows = await db.query(
  'select u.name, p.title from users u join posts p on u.id = p.user_id',
);
//     rows.value ^? { name: string; title: string }[]
```

An outer join makes the optional side's columns nullable: `LEFT` nulls the
right-hand table, `RIGHT` nulls the left-hand table, and `FULL` nulls both.

```ts
const rows = await db.query(
  'select u.name, p.title from users u left join posts p on u.id = p.user_id',
);
//     rows.value ^? { name: string; title: string | null }[]
```

`select *` across a join merges the columns of every table (applying join
nullability). In strict mode, an unknown alias becomes
`QueryTypeError<'unknown alias: x'>`.

### 10. Typed parameters

Placeholders in the query are typed from the column they're compared against, so
`query` checks the **number and types** of the arguments you pass:

```ts
await db.query('select id from users where id = $1', 1);
//                                          ^ inferred [number]

await db.query('select id from users where id = $1 and name = $2', 1, 'ada');
//                                                          inferred [number, string]

// @ts-expect-error wrong type — id is a number
await db.query('select id from users where id = $1', 'oops');

// @ts-expect-error wrong count — one param expected
await db.query('select id from users where id = $1');
```

Both numbered (`$1`, `$2`) and positional (`?`) placeholders work, including
across joins (`where p.views > $1` resolves against the aliased table). Use the
`Params<DB, Q>` type to get the tuple on its own.

For this to work, write the comparison **with spaces around the operator**
(`id = $1`, not `id=$1`) — that is what lets the compiler see the column,
operator, and placeholder as separate tokens.

**Placeholder-style checking (opt-in).** The type layer accepts `$n`, `?` and
`@name` interchangeably, but each driver only understands its own style — `?`
with the pg adapter is a runtime syntax error. Declare the style your executor
expects and mismatches become compile errors:

```ts
const db = createTypedDb<DB, { placeholders: 'dollar' }>(createPgExecutor(pool));

// @ts-expect-error '?' is not a pg placeholder — use $1
await db.query('select id from users where id = ?', 1);
```

Styles: `'dollar'` (pg, postgres.js), `'question'` (mysql2), `'at'` (mssql).
`node:sqlite` accepts all three plus `:name`, so leave the option off there.
A `:name` placeholder is typed like any other but carries no style of its own,
so it is never checked against a declared dialect.

**Write metadata.** Adapters report driver metadata alongside the rows: on a
successful `Result`, `result.meta?.rowCount` carries the affected-row count
and `result.meta?.lastInsertRowid` the generated id (where the driver
provides one), so an INSERT without `RETURNING` is no longer a black box.

### 11. Transactions

There is a footgun to know about: **never run `BEGIN`/`COMMIT` through an
executor bound to a pool.** Each `query()` may check out a *different*
connection, so `BEGIN` runs on connection A and `COMMIT` on connection B,
leaving an open transaction (and its locks) on a pooled connection that is
later handed to another caller.

`pg`, `postgres.js`, `mysql2`, and `mssql` each ship a small transaction
helper that pins one connection for the whole callback and handles
begin/commit/rollback for you:

```ts
import { Pool } from 'pg';
import { createPgTransaction } from '@owlsql/core/pg';

const pool = new Pool();

async function transferFunds(from: number, to: number, amount: number) {
  await createPgTransaction<DB>(pool)(async (tx) => {
    await tx.query('update accounts set balance = balance - $1 where id = $2', amount, from);
    await tx.query('update accounts set balance = balance + $1 where id = $2', amount, to);
  });
}
```

`createPgTransaction<DB>(pool)` returns the function that actually runs the
transaction — it's curried on `DB` because TypeScript can't partially infer
type arguments; a single `createPgTransaction<DB>(pool, fn)` call would
compile, but would silently stop inferring the callback's return type and
type it `unknown` instead. Splitting `DB` into its own call keeps the second
call (`(fn, options?)`) argument-only, so both the optional `options` and the
callback's return type infer normally.

The callback's `tx` is a full `TypedDb<DB>`, typed exactly like the one
`createTypedDb` returns (pass `{ strict: true }` as the second argument to
the inner call the same way: `createPgTransaction<DB>(pool)(fn, { strict:
true })`). The transaction commits if the callback resolves and rolls back if
it throws — a rejected `tx.query()` result (the normal `Result` error path)
does *not* trigger a rollback by itself, only a thrown error does, same as
everywhere else this library never throws on a query failure.

`createMysql2Transaction<DB>(pool)(fn, options?)` and
`createMssqlTransaction<DB>(pool)(fn, options?)` work the same way.
`createPostgresJsTransaction<DB>(sql)(fn, options?)` wraps postgres.js's own
`sql.begin(...)`, which already pins the connection and handles
commit/rollback itself.

Kysely users should use Kysely's own `db.transaction()`. `node:sqlite` is a
single connection, so plain `begin`/`commit` statements are safe there and no
helper is provided.

If the rollback *itself* fails, the helper throws an `AggregateError` whose
`errors[0]` is the original failure and `errors[1]` is the rollback failure —
the error that caused the transaction to be abandoned is never replaced by a
cleanup error.

Under the hood, each helper does exactly what you'd otherwise write by hand:

```ts
const client = await pool.connect();
const tx = createTypedDb<DB, { placeholders: 'dollar' }>(createPgExecutor(client), { placeholders: 'dollar' });

try {
  await client.query('begin');
  await tx.query('update accounts set balance = balance - $1 where id = $2', amount, from);
  await tx.query('update accounts set balance = balance + $1 where id = $2', amount, to);
  await client.query('commit');
} catch (error) {
  await client.query('rollback');
  throw error;
} finally {
  client.release();
}
```

## Driver recipes

The executor is the only thing that touches your database, so any driver
works. For the most common drivers, OwlSQL ships a ready-made
adapter — import it from its own subpath and pass your existing client
straight in. No dependency is pulled in unless you import that specific
subpath (each driver is an optional peer dependency).

**node-postgres (`pg`)**

```ts
import { Pool } from 'pg';
import { createPgExecutor } from '@owlsql/core/pg';

const db = createTypedDb<DB>(createPgExecutor(new Pool()));
```

**mysql2**

```ts
import { createPool } from 'mysql2/promise';
import { createMysql2Executor } from '@owlsql/core/mysql2';

const db = createTypedDb<DB>(createMysql2Executor(createPool({ /* ... */ })));
```

**postgres.js**

```ts
import postgres from 'postgres';
import { createPostgresJsExecutor } from '@owlsql/core/postgres';

const db = createTypedDb<DB>(createPostgresJsExecutor(postgres()));
```

**node:sqlite** (Node's built-in SQLite module, no dependency to install — Node ≥22.5)

```ts
import { DatabaseSync } from 'node:sqlite';
import { createNodeSqliteExecutor } from '@owlsql/core/node-sqlite';

const db = createTypedDb<DB>(createNodeSqliteExecutor(new DatabaseSync('app.db')));
```

**better-sqlite3** (synchronous driver wrapped in a promise — no dedicated
adapter, the same one-liner works with `node:sqlite`'s adapter since both
expose `prepare(sql).all(...params)`)

```ts
import Database from 'better-sqlite3';
const sqlite = new Database('app.db');
const db = createTypedDb<DB>(async (sql, params) => sqlite.prepare(sql).all(...params));
```

**Kysely**

```ts
import { Kysely, PostgresDialect } from 'kysely';
import { createKyselyExecutor } from '@owlsql/core/kysely';

const kysely = new Kysely<KyselySchema>({ dialect: new PostgresDialect({ /* ... */ }) });
const db = createTypedDb<DB>(createKyselyExecutor(kysely));
```

The adapter runs your query through `CompiledQuery.raw`, which forwards the
SQL text and parameters straight to the underlying driver with **no
placeholder translation** — the SQL you write still has to use whichever
placeholder syntax your configured dialect's own driver expects (`$1` for
`PostgresDialect`, `?` for `MysqlDialect`/`SqliteDialect`). What the adapter
does *not* care about is which Kysely dialect object you passed in; it just
relays whatever string you give it.

If you want the same compile-time protection against using the wrong
placeholder style that the other adapters get, pass `placeholders` to
`createTypedDb` the same way you would for any of them — it's driven by
that option, not by which adapter produced the executor:

```ts
const db = createTypedDb<DB, { placeholders: 'question' }>(createKyselyExecutor(kysely));
```

**Drizzle (raw SQL)**

Drizzle's own `sql.raw()` doesn't take a separate parameters array, so it
can't be wired directly into an `Executor`. Instead, reach through Drizzle to
the underlying driver client with [`db.$client`](https://orm.drizzle.team/docs/connect-overview)
and reuse the matching adapter above — one extra line over the plain driver:

```ts
import { drizzle } from 'drizzle-orm/node-postgres';
import { createPgExecutor } from '@owlsql/core/pg';

const drizzleDb = drizzle(process.env.DATABASE_URL!);
const db = createTypedDb<DB>(createPgExecutor(drizzleDb.$client));
```

Swap `createPgExecutor` for `createMysql2Executor`/`createPostgresJsExecutor`/
`createNodeSqliteExecutor` depending on which Drizzle driver you're using —
`$client` is always the native driver instance underneath.

**mssql (SQL Server)**

```ts
import sql from 'mssql';
import { createMssqlExecutor } from '@owlsql/core/mssql';

const pool = await sql.connect({ /* ... */ });
const db = createTypedDb<DB>(createMssqlExecutor(pool));
```

The adapter scans the query for `@name` placeholders (skipping string
literals and `@@` system variables) and binds each one by name via
`request.input(...)`, in order of first appearance — matching how
`Params<DB, Q>` types the positional tuple. A repeated `@name` binds once.

## Database support

The parser accepts the SQL used by each of the four major engines, without any
per-dialect configuration — it stays permissive and recognizes each dialect's
syntax by shape, not by a declared "mode".

| Feature | PostgreSQL | MySQL | SQLite | SQL Server |
| ------- | ---------- | ----- | ------ | ---------- |
| Placeholders | `$1`, `$2`, ... | `?` | `?` | `@name`, `@p1` |
| Quoted identifiers | `"col"` | `` `col` `` | `"col"` | `[col]`, `"col"` |
| Row-returning writes | `RETURNING col` | *(not supported by the engine — `INSERT`/`UPDATE`/`DELETE` type as `Record<string, never>[]`)* | `RETURNING col` | `OUTPUT inserted.col` / `OUTPUT deleted.col` |
| Pagination | `LIMIT n OFFSET m` | `LIMIT n OFFSET m` | `LIMIT n OFFSET m` | `TOP n`, `TOP (n) PERCENT`, or `OFFSET ... FETCH NEXT n ROWS ONLY` |
| `ILIKE` | ✓ | — | — | — |
| Joins, CTEs, `CASE`, window functions, subqueries in `FROM` | ✓ | ✓ | ✓ | ✓ (dialect-agnostic — see [Supported SQL subset](#supported-sql-subset)) |

See [`tests/dialect-postgres.test-d.ts`](tests/dialect-postgres.test-d.ts),
[`tests/dialect-mysql.test-d.ts`](tests/dialect-mysql.test-d.ts),
[`tests/dialect-sqlite.test-d.ts`](tests/dialect-sqlite.test-d.ts), and
[`tests/dialect-mssql.test-d.ts`](tests/dialect-mssql.test-d.ts) for the exact
query shapes each engine is tested against.

## Editor autocomplete

```ts
db.query(`
  select id, na
`)
//              ^ autocomplete suggests `name`

db.query(`select id, name from users`)
//                    ^ hovering shows (column) name: string

db.query(`select id from users where na`)
//                                    ^ autocomplete suggests `name`
```

Want to see it running for yourself before there's a recorded demo here?
[`examples/ts-plugin-demo`](examples/ts-plugin-demo) is a ready-to-open
VSCode project set up for exactly that.

`@owlsql/ts-plugin` is a **TypeScript Language Service Plugin** —
it runs inside `tsserver`, the same process that already powers VSCode's
IntelliSense, and adds column-name completions while you're still typing the
query string. This is a genuinely different mechanism from the rest of the
library: everything else works by *type-checking* a finished query string;
this works by hooking into the editor's completion request for a string
that isn't even valid SQL yet.

**Setup** — it ships as its own package, so install it first.

> **Not on npm yet.** `@owlsql/ts-plugin` has not been published; the
> command below will be the install once it is. Until then, build it from a
> clone of this repository and install that folder:
>
> ```bash
> git clone https://github.com/tiagolauer/OwlSQL
> cd OwlSQL && npm install && npm run build --workspace @owlsql/ts-plugin
> cd /path/to/your/project
> npm install --save-dev /path/to/OwlSQL/ts-plugin
> ```
>
> Everything below this box is the same either way.

```bash
npm install --save-dev @owlsql/ts-plugin
```

Then add it to your `tsconfig.json`:

```json
{
  "compilerOptions": {
    "plugins": [{ "name": "@owlsql/ts-plugin" }]
  }
}
```

Then, in VSCode, open the Command Palette and run **"TypeScript: Select
TypeScript Version" → "Use Workspace Version"**. This step is not optional —
VSCode's *bundled* TypeScript does not load workspace plugins, so skipping it
is the #1 reason this kind of plugin appears to do nothing. Other editors
that talk to `tsserver` (Cursor, some Neovim/Sublime LSP setups) generally
pick up `tsconfig.json` plugins automatically.

**What it does:** suggests column names right after `SELECT`/a comma in the
column list or after `WHERE`/`AND`/`OR`, suggests table names right after
`FROM`/`JOIN` (or a comma in an old-style comma-joined `FROM` list), and
shows a column's resolved type on hover, for `db.query(...)` calls made
through a client built with `createTypedDb<DB>`. It is `JOIN`/alias-aware:
every table introduced by a `FROM` or `JOIN` in the same string is in scope,
and typing an alias qualifier (`u.` in `... from users u`) narrows
completions and hover to that one source. With no qualifier, completions/hover
union columns across all sources present so far — the deduplicated union of
every table in `DB` before any `FROM` is typed at all, exactly what covers
the example above. `WHERE`-position completions require a `FROM` to already
be present (there's no table to scope to otherwise); table-name completions
after `FROM`/`JOIN` suggest every table in `DB`, filtered by whatever prefix
you've typed. It also reports unknown columns, unknown tables, unknown
aliases, and ambiguous unqualified columns (present in more than one joined
table) as live editor diagnostics in the `SELECT` list, `FROM`/`JOIN` clause,
and simple `WHERE` comparisons (`where naem = 'x'` squiggles `naem` the
moment you type it) — the same checks strict mode (`{ strict: true }`)
applies at compile time, surfaced as a squiggle while you type instead of
only once the query is finished.

**What it does not do** (documented scope, not bugs):

- **`WHERE`-clause diagnostics cover simple comparisons only.** A column
  token immediately before `=`/`<>`/`<`/`>`/`<=`/`>=`/`LIKE`/`ILIKE`/`IN`/
  `BETWEEN`/`IS`, or `AND`/`OR`, or the end of the clause, is checked exactly
  like a `SELECT`-list column. The moment a `WHERE` clause contains any `(`
  or `)` at all — a subquery, a function call, a parenthesized group — the
  whole clause is skipped rather than risked: no diagnostics for it, never a
  wrong one. `HAVING`/`ORDER BY`/`GROUP BY` aren't checked at all.
- The first `FROM <table>` is found with a regex, not a real SQL parser: a
  `FROM (subquery)` can make it lock onto a table name from inside the
  subquery instead of recognizing there's no real outer table yet.
- Only plain string/template literals with **no interpolation**
  (`` db.query(`select ...`) ``) are recognized — which is the only form the
  library ever expects you to write, since parameters are SQL placeholders
  (`$1`/`?`/`@name`), never JS template interpolation. Interpolating
  (`` db.query(`select ... ${x}`) ``) silently turns completions/hover off
  for that call — there's no squiggle or warning telling you why.
- Completions after `ORDER BY`/`GROUP BY`/`HAVING`/etc. aren't offered yet —
  only the `SELECT` column list, `WHERE` clause, and `FROM`/`JOIN` table
  names.
- **Requires TypeScript < 7**, which its own `peerDependencies` range
  enforces. TypeScript 7's native (Go-based) compiler ships no public
  compiler API at all — the classic `ts.Node`/`ts.forEachChild`/
  `ts.createProgram` surface this plugin is built on is gone, and the
  `tsserver` protocol that loads plugins has been replaced by LSP. That
  affects every TypeScript language service plugin, not just this one;
  TypeScript 7.1 is expected to introduce a new (and different) programmatic
  API. The library itself is unaffected and is tested against TypeScript 7 in
  CI — this is exactly why the plugin lives in a separate package with a
  separate version, so `@owlsql/core` isn't held to the plugin's narrower
  range.

## API reference

| Export | Kind | Description |
| ------ | ---- | ----------- |
| `createTypedDb<DB>(executor)` / `createTypedDb<DB, Options>(executor, options?)` | function | Build a schema-bound client. When passing `options`, `DB` and `Options` must **both** be given explicitly — `createTypedDb<DB>(executor, options)` with a single type argument is a compile error, not a silent no-op. `options.strict` enables [strict mode](#8-strict-mode--turn-typos-into-type-errors); `options.placeholders` enables [placeholder-style checking](#10-typed-parameters). |
| `TypedDb<DB, Strict?, Style?>` | interface | The client; has `query<Q>(sql, ...params)`. |
| `TypedDbOptions` | interface | `{ strict?: boolean; placeholders?: PlaceholderStyle }`. |
| `Executor` | type | `(sql: string, params: readonly unknown[]) => Promise<ExecutorResult>`. |
| `ExecutorResult` | type | `unknown[]` or `{ rows: unknown[]; meta?: QueryMeta }`. |
| `QueryMeta` | interface | `{ rowCount?; lastInsertRowid? }`, surfaced on the Ok result. |
| `PlaceholderStyle` | type | `'dollar' \| 'question' \| 'at'`. |
| `DialectExecutor<Style>` | type | An `Executor` annotated with its placeholder style. |
| `Query<DB, Q>` | type | Inferred result array for query `Q`. |
| `Row<DB, Q>` | type | Inferred single-row object for query `Q`. |
| `StrictQuery<DB, Q>` | type | Like `Query`, but unknown columns/tables become a `QueryTypeError`. |
| `StrictRow<DB, Q>` | type | Single-row strict variant. |
| `InferResult<DB, Q>` / `InferRow<DB, Q>` | type | Underlying aliases of `Query` / `Row` (plus `InferResultStrict` / `InferRowStrict`). |
| `Params<DB, Q>` / `InferParams<DB, Q>` | type | Inferred parameter tuple for query `Q`. |
| `QueryTypeError<Message>` | type | Branded compile-time error carrying `Message`. |
| `FunctionReturnTypes` | interface | SQL-function → return-type registry. |
| `Result<T, E>` | type | `Ok<T> \| Err<E>` discriminated union (`Ok` / `Err` are exported too). |
| `ResultStatus` | enum | `Ok` / `Error`. |
| `ok` / `err` | function | Construct a success / error result. |
| `isOk` / `isErr` | function | Type-narrowing guards. |
| `QueryError` | interface | `{ kind, message, cause? }`. |
| `QueryErrorKind` | enum | `EMPTY_QUERY` / `EXECUTOR_FAILED`. |
| `Schema` / `SchemaLike` | type | Ideal schema shape (`table → column → type`) / the loosest accepted shape. |
| `defineSchema(obj)` | function | Optional identity helper (see below). |
| `ParseSelect` / `ParseStatement` / `ParsedStatement` / `Source` | type | Parser internals, exported for advanced tooling; not needed for normal use and more likely to change between minor versions. |

**Driver adapters** (each on its own subpath, so no unused peer dependency is
ever required):

| Export | Subpath | Description |
| ------ | ------- | ----------- |
| `createPgExecutor(client)` | `@owlsql/core/pg` | `pg` `Pool \| Client \| PoolClient` → `Executor`. |
| `createMysql2Executor(connection)` | `@owlsql/core/mysql2` | `mysql2/promise` `Pool \| Connection` → `Executor`. |
| `createPostgresJsExecutor(client)` | `@owlsql/core/postgres` | `postgres.Sql` → `Executor`. |
| `createNodeSqliteExecutor(db)` | `@owlsql/core/node-sqlite` | `node:sqlite` `DatabaseSync` → `Executor`. |
| `createMssqlExecutor(pool)` | `@owlsql/core/mssql` | `mssql` `ConnectionPool` → `Executor`, binding `@name` params. |
| `createKyselyExecutor(db)` | `@owlsql/core/kysely` | `Kysely<DB>` → `Executor`, via `CompiledQuery.raw`. |
| `createPgTransaction<DB>(pool)(fn, options?)` | `@owlsql/core/pg` | Pins a `PoolClient`, runs `fn(tx)` inside `BEGIN`/`COMMIT`/`ROLLBACK`. Curried on `DB` - see [Transactions](#11-transactions). |
| `createMysql2Transaction<DB>(pool)(fn, options?)` | `@owlsql/core/mysql2` | Same shape, over a pinned mysql2 `Connection`. |
| `createPostgresJsTransaction<DB>(sql)(fn, options?)` | `@owlsql/core/postgres` | Same shape, wrapping postgres.js's own `sql.begin(...)`. |
| `createMssqlTransaction<DB>(pool)(fn, options?)` | `@owlsql/core/mssql` | Same shape, over a pinned mssql `Transaction`. |

**`query` return type.** `query` resolves to
`Result<Query<DB, Q>, QueryError>`. On success, `result.value` holds the typed
rows. On failure, `result.error` is a `QueryError`:

- `EMPTY_QUERY` — the SQL string was empty/whitespace (guarded before the
  executor runs).
- `EXECUTOR_FAILED` — your executor threw; the original error is on
  `error.cause`.

**Optional: `defineSchema`.** An identity helper that returns its argument
typed as a `Schema`, for the rare case where you keep a runtime schema object
and want it validated against the expected shape. The schema is purely
type-level, so **most projects just write `type DB = { ... }` and never need
this.**

## Supported SQL subset

| Feature | Example |
| ------- | ------- |
| Column projection | `select id, name from users` |
| `SELECT *` | `select * from users` |
| Explicit alias | `select name as username from users` |
| Implicit alias | `select name username from users` |
| Qualified columns | `select u.id, u.name from users u` |
| Case-insensitive keywords | `SELECT id FROM users` |
| Newlines / messy whitespace | multi-line queries are normalized |
| Trailing clauses (ignored) | `... where active = true order by id limit 10` |
| Aggregates / functions | `select count(*) as total, lower(name) from users` |
| `RETURNING` | `insert into users (name) values ($1) returning id` |
| Aliased write target | `update users u set name = $1 where u.id = $2 returning u.name` |
| Nullable columns | `bio: string \| null` → `{ bio: string \| null }` |
| Joins | `select u.name, p.title from users u join posts p on u.id = p.user_id` |
| `LEFT`/`RIGHT`/`FULL` nullability | outer-joined side(s) become `T \| null` |
| Qualified / mixed star | `select u.*, p.title from ...`, `select *, extra from ...` |
| Quoted / schema-qualified ids | `select "id" from public."users"`, `select "first name" from [Order Details]` |
| Trailing semicolon | `select id from users;` |
| Typed parameters | `where id = $1` → `query(sql, id: number)` |
| Strict mode | `{ strict: true }` → unknown column becomes a `QueryTypeError` (`SELECT` list, `WHERE`, and `JOIN ... ON`) |
| `WHERE` operators | `=`, `<>`, comparisons, `LIKE`/`ILIKE`, `IN (...)`, `BETWEEN ... AND ...`, `IS [NOT] NULL`, `IS [NOT] DISTINCT FROM`, `AND`/`OR`, `@>`/`<@` |
| `GROUP BY` / `HAVING` / `ORDER BY` / `LIMIT` / `OFFSET` | parsed and skipped; output shape follows the `SELECT` list, `HAVING`/`LIMIT`/`OFFSET` placeholders are typed |
| `UNION` / `UNION ALL` | result shape is inferred from the first branch |
| `CASE WHEN ... THEN ... [ELSE ...] END` | branch types are unioned (`\| null` added when there is no `ELSE`) |
| Window functions | `row_number() over (partition by ... order by ...)`, `rank()`, `dense_rank()`, etc. |
| CTEs (`WITH ... AS (...)`) | later CTEs may reference earlier ones; works with strict mode |
| Derived tables | `from (select ...) x`, including subqueries with their own `WHERE`/`JOIN` |
| Named parameters | `where id = @id` (SQL Server style) |
| Backtick identifiers | `` select `id` from `users` `` (MySQL style) |
| `TOP` clause | `select top 10 id from users`, `top (n)`, `top n percent`, `top n with ties` (SQL Server) |
| `OUTPUT` clause | `insert ... output inserted.id values (...)` (SQL Server) |
| `MERGE ... OUTPUT` | `merge into t as target using ... on ... when matched then ... output inserted.id, $action` (SQL Server) — see [Limitations](#limitations) |

## Limitations

This is a focused tool for the common read path, not a full SQL grammar:

- **Scalar subqueries in the `SELECT` list are typed for the simple case** —
  a single-column, non-nested subquery (`select (select count(*) from posts
  where posts.user_id = users.id) as post_count from users`) resolves to
  that column's type, with `| null` added since a scalar subquery yields
  NULL on zero rows (`count(...)` subqueries are exempt — they always
  return a row). A subquery selecting more than one column resolves to
  `unknown` in normal mode (rather than picking one arbitrarily) and to a
  `QueryTypeError` in strict mode, since selecting more than one column
  from a scalar subquery is invalid SQL. Subqueries used as a value inside
  `WHERE` are not typed at all (`WHERE` isn't part of the typed structure —
  only scanned for parameter placeholders).
- **Nested `CASE` is supported** — a `CASE` expression inside another
  `CASE`'s `WHEN`/`THEN`/`ELSE` branch is parsed and typed like any other
  branch expression.
- **Window `OVER (...)` clauses are only used as a boundary**, not parsed for
  their own typing — `PARTITION BY`/`ORDER BY` content inside `OVER (...)` is
  discarded, not validated.
- **Aggregates assume numeric output, dialect-agnostically.** `min`/`max`
  resolve to `number` even over a text column; unrecognized functions resolve
  to `unknown`. `count`, `sum`, and `avg` also resolve to `number`, but that's
  not always what comes back at runtime: with `pg`'s default config (no
  custom `types` parser), `count(*)`/`count(col)` is `bigint` and
  `sum(int_col)`/`avg(...)` is `numeric` at the SQL level, and `pg` decodes
  both as JS strings to avoid precision loss — the same reason plain
  `bigint`/`numeric` *columns* map to `string` (see [Type mapping follows
  each driver's defaults](#1-describe-your-schema)). Cast at the call site
  (`Number(rows[0].count)`, or a BigInt-aware conversion) if you need to do
  arithmetic on it. `lag`, `lead`, `first_value`, `last_value`, `nth_value`
  resolve to `unknown` (their real type depends on the argument, which isn't
  inspected).
- **`select *` across a join merges columns by name.** When two tables share a
  column name (e.g. both have `id`), the types are intersected rather than kept
  separate. Alias the columns to keep them distinct.
- **Typed parameters need spaced operators.** `where id = $1` is typed;
  `where id=$1` is not. A placeholder inside a call is typed
  (`lower($1)`, `coalesce($1, 0)`), but two placeholders glued into one
  space-delimited token (`coalesce($1,$2)`) are not — write the comma with a
  space. `= any($1)` and `= all($1)` compare against the whole list, so their
  slot is an array of the column's type (`number[]`, not `number`).
  `INSERT ... VALUES` parameters are matched
  positionally against the INSERT's column list — `insert into t (a, b)
  values ($1, $2)` types `$1`/`$2` as `a`/`b`; without an explicit column
  list they fall back to a flexible `unknown[]`. Placeholders inside a
  `WITH` CTE's own body are typed against that CTE's own `FROM` source (and
  earlier CTEs it references), in the same textual order they appear in the
  query, ahead of placeholders in the outer query that follows the `WITH`
  clause. Numbered placeholders bind by
  their index (`$2` fills the second tuple slot even when it appears first);
  a repeated `$n` occupies a single slot.
- **Quoted identifiers** use `"..."` (standard), `[...]` (SQL Server), or
  `` `...` `` (MySQL — escape the backtick with `\`` inside the template
  literal). A quoted name may contain spaces (`"first name"`,
  `[Order Details]`) — which is what quoting is for, and what `owlsql
  generate` writes when a real column is named that way. Schema-qualified
  tables (`public.users`) resolve by their final segment (`users`).
- **`TOP` supports a plain count, `TOP N PERCENT`, `TOP N WITH TIES`, and
  `TOP N PERCENT WITH TIES`** (`PERCENT` before `WITH TIES`, the only order
  T-SQL accepts) — none of
  these affect the inferred row shape, same as `LIMIT`/`OFFSET`. `OUTPUT`
  only recognizes the `inserted`/`deleted` pseudo-table prefixes (they
  resolve against the statement's single table); `OUTPUT ... INTO @table` is
  not supported.
- **`MERGE` types the target table and `OUTPUT` clause, not the merge logic
  itself.** The `USING`/`ON`/`WHEN MATCHED`/`WHEN NOT MATCHED` branches aren't
  parsed or validated — only `MERGE INTO <target>` (an explicit `INTO` is
  required; the rarely-used `MERGE <target> USING ...` form without it isn't
  recognized) and the trailing `OUTPUT` clause, resolved against the target
  table the same way `OUTPUT` already works for `INSERT`/`UPDATE`/`DELETE`.
  `OUTPUT $action` is recognized and typed as `'INSERT' | 'UPDATE' |
  'DELETE'`.
- **Unknown columns, tables, or aliases resolve to `unknown`** by default — pass
  `{ strict: true }` to turn them into a `QueryTypeError` instead. Strict mode
  covers the `SELECT` list, the `WHERE` clause, and `JOIN ... ON` conditions;
  `GROUP BY`, `HAVING`, and `ORDER BY` are left alone, since a name there can
  be a `SELECT`-list alias, an ordinal, or an aggregate rather than a column
  of a source table.
- **One statement per query.** A semicolon is only allowed at the end. A
  second statement after one (`select id from users; drop table users`) is a
  `QueryTypeError` in both modes, for the row type and for the parameter
  tuple — this isn't a schema question, so strict mode has nothing to be
  stricter about, and inferring a row from two merged statements would be
  confidently wrong rather than merely permissive.

These are deliberate scope choices; the [FAQ](#faq) covers how to work around
them.

## FAQ

**Does this run SQL or connect to a database?** No. It only types the result.
You supply the executor that talks to your driver.

**Is there a build step or codegen?** No. The types are computed by `tsc` during
your normal type check. Nothing is generated and nothing is written to disk.

**My result is typed `unknown[]`.** The query was likely passed as a `string`
variable instead of a string literal, or it selects a column/table not in your
schema. Inline the literal and check the schema.

**How do I handle a `JOIN`?** `JOIN` is inferred natively — see
[section 9](#9-joins). `INNER`/`LEFT`/`RIGHT`/`FULL`/`CROSS` are all
supported, including nullability of the outer-joined side.

**Why a `Result` instead of throwing?** Database calls are expected to fail
sometimes; modelling that as a value (rather than an exception) forces callers
to handle it and keeps error handling explicit and type-checked.

## Contributing

Building, testing, and publishing are documented in
[CONTRIBUTING.md](CONTRIBUTING.md). Not sure where to start? Check
[ROADMAP.md](ROADMAP.md) — it lists what's shipped, what's in progress, and
issues labeled [`good first issue`](https://github.com/tiagolauer/OwlSQL/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22).

[VERSIONING.md](VERSIONING.md) covers what counts as a breaking change here.
Since the product is inferred types, a release can break your build without
touching a single runtime signature, so the classification is written down
rather than left to judgement.

## License

MIT
