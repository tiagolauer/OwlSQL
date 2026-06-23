# sql-template-typed

> Write raw SQL. Get fully-typed results. No codegen, no ORM, no runtime parsing.

`sql-template-typed` reads your SQL **inside TypeScript's type system** and
infers the row shape directly from the query string and your schema. The query
`'select id, name from users'` becomes `{ id: number; name: string }[]` — at
edit time, in your IDE, with zero build step.

```ts
const result = await db.query('select id, name from users');

if (result.status === ResultStatus.Ok) {
  result.value;
  //     ^? { id: number; name: string }[]
}
```

---

## Table of contents

- [What it does](#what-it-does)
- [Why I built it](#why-i-built-it)
- [How it works](#how-it-works)
- [Install](#install)
- [Tutorial](#tutorial)
  - [1. Describe your schema](#1-describe-your-schema)
  - [2. Create a typed client](#2-create-a-typed-client)
  - [3. Run queries and handle the Result](#3-run-queries-and-handle-the-result)
  - [4. Aliases, `*`, and qualified columns](#4-aliases--and-qualified-columns)
  - [5. Type-only usage (no client)](#5-type-only-usage-no-client)
- [Driver recipes](#driver-recipes)
- [API reference](#api-reference)
- [Supported SQL subset](#supported-sql-subset)
- [Limitations](#limitations)
- [FAQ](#faq)
- [Publishing](#publishing)
- [Development](#development)
- [License](#license)

---

## What it does

You give it two things:

1. A **schema** — a TypeScript type mapping each table to its columns and their
   types.
2. A **SQL query** — written as a plain string literal.

It gives you back the **exact result type**, computed by the compiler from the
text of the query:

```ts
type DB = {
  users: { id: number; name: string; email: string; active: boolean };
};

const a = await db.query('select id from users');
//        a.value ^? { id: number }[]

const b = await db.query('select name as handle, active from users');
//        b.value ^? { handle: string; active: boolean }[]

const c = await db.query('select * from users');
//        c.value ^? { id: number; name: string; email: string; active: boolean }[]
```

Rename a column in the SQL, mistype a field, or select something that does not
exist, and the result type changes immediately — before you run a single line.
There is **no generated file to keep in sync** and **no SQL parser shipped to
production**: all the work happens during type checking.

It is **not** an ORM and **not** a query builder. It does not connect to your
database. You keep writing the SQL you already know; this library only layers
compile-time result typing on top of whatever driver you use.

## Why I built it

I was building a TypeScript backend and deliberately chose **raw SQL** over an
ORM — I wanted full control over the queries, predictable performance, and no
magic between my code and the database. That part worked great.

The pain was the **return types**. Every query handed me back `any[]` (or
`unknown[]`), so I hand-wrote an interface for each result:

```ts
interface UserListRow { id: number; name: string }
const rows = (await pool.query('select id, name from users')).rows as UserListRow[];
```

Two problems showed up fast:

1. **They drift.** Someone edits the SQL to also select `email`, but forgets the
   interface. Now the type lies, and the bug only surfaces at runtime — usually
   in production.
2. **They're pure boilerplate.** The interface is just the query restated in
   another syntax. I was typing the same column list twice.

The usual fixes did not fit:

- **ORMs** (Prisma, TypeORM) replace my SQL with their own DSL and runtime — the
  exact thing I was trying to avoid.
- **Codegen tools** (Prisma, `pgtyped`, Kysely-codegen) do give accurate types,
  but they bolt a **generation step** onto the build: a watcher, a CLI, a
  database connection at build time, generated files in version control. More
  moving parts to break in CI.

What I actually wanted was simple: **the query string is already the source of
truth — let the compiler read it.** TypeScript's template literal types are
powerful enough to parse a `SELECT` and map columns to a schema, entirely at
type-check time. So I wrote that. No DSL, no generated files, no build step —
just the SQL I was already writing, now correctly typed.

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
npm install sql-template-typed
```

`typescript` is a peer dependency (**>= 5.0** — required for template literal
type recursion). You almost certainly already have it.

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
no runtime cost — it is erased during compilation.

### 2. Create a typed client

The library never touches your database. You hand `createTypedDb` an
**executor**: a function that takes `(sql, params)`, runs it against your real
driver, and returns the raw rows.

```ts
import { Pool } from 'pg';
import { createTypedDb } from 'sql-template-typed';

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
import { ResultStatus } from 'sql-template-typed';

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
import { isOk } from 'sql-template-typed';

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
import type { Query } from 'sql-template-typed';

type UserListRow = Query<DB, 'select id, email from users'>;
//   ^? { id: number; email: string }[]

function renderUsers(rows: Query<DB, 'select id, name from users'>) {
  // rows is { id: number; name: string }[]
}
```

`Row<DB, Q>` gives the single-row object (without the surrounding array) if you
need it.

## Driver recipes

The executor is the only thing that touches your database, so any driver works.
Each recipe is the same five lines, adapted to one client.

**node-postgres (`pg`)**

```ts
import { Pool } from 'pg';
const pool = new Pool();
const db = createTypedDb<DB>(async (sql, params) => {
  const res = await pool.query(sql, params as unknown[]);
  return res.rows;
});
```

**mysql2**

```ts
import { createPool } from 'mysql2/promise';
const pool = createPool({ /* ... */ });
const db = createTypedDb<DB>(async (sql, params) => {
  const [rows] = await pool.query(sql, params as unknown[]);
  return rows as unknown[];
});
```

**better-sqlite3** (synchronous driver wrapped in a promise)

```ts
import Database from 'better-sqlite3';
const sqlite = new Database('app.db');
const db = createTypedDb<DB>(async (sql, params) => {
  return sqlite.prepare(sql).all(...params);
});
```

**postgres.js**

```ts
import postgres from 'postgres';
const sql = postgres();
const db = createTypedDb<DB>(async (text, params) => {
  return sql.unsafe(text, params as unknown[]);
});
```

## API reference

| Export | Kind | Description |
| ------ | ---- | ----------- |
| `createTypedDb<DB>(executor)` | function | Build a schema-bound client. |
| `TypedDb<DB>` | interface | The client; has `query<Q>(sql, ...params)`. |
| `Executor` | type | `(sql: string, params: readonly unknown[]) => Promise<unknown[]>`. |
| `Query<DB, Q>` | type | Inferred result array for query `Q`. |
| `Row<DB, Q>` | type | Inferred single-row object for query `Q`. |
| `Result<T, E>` | type | `Ok<T> \| Err<E>` discriminated union. |
| `ResultStatus` | enum | `Ok` / `Error`. |
| `ok` / `err` | function | Construct a success / error result. |
| `isOk` / `isErr` | function | Type-narrowing guards. |
| `QueryError` | interface | `{ kind, message, cause? }`. |
| `QueryErrorKind` | enum | `EMPTY_QUERY` / `EXECUTOR_FAILED`. |
| `Schema` | type | Ideal schema shape (`table → column → type`). |
| `defineSchema(obj)` | function | Optional identity helper (see below). |

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

## Limitations

This is a focused tool for the common read path, not a full SQL grammar:

- **One table per query.** No `JOIN` result merging yet.
- **`SELECT *` must be the only item.** `select *, extra` is not supported.
- **Expressions and function calls** (`count(*)`, `lower(name)`) resolve to
  `unknown`.
- **Unknown columns or tables resolve to `unknown`**, not a type error — kept
  permissive on purpose so a typo degrades gracefully rather than nuking the
  whole row type.

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

**How do I handle a `JOIN` today?** Write the SQL as usual and annotate the
result type yourself with `Query<...>` for the parts that are inferable, or fall
back to a hand-written row type for that one query. JOIN inference is on the
roadmap.

**Why a `Result` instead of throwing?** Database calls are expected to fail
sometimes; modelling that as a value (rather than an exception) forces callers
to handle it and keeps error handling explicit and type-checked.

## Publishing

The package ships compiled JavaScript + declarations from `dist/`. The build is
wired into `prepublishOnly`, so a normal publish compiles for you:

```bash
npm version <patch|minor|major>
npm publish            # runs test:types, then build, then publishes dist/
```

Before the first registry publish, the package is still usable via a local path
(`npm i file:../sql-template-typed`), a tarball (`npm pack`), a workspace
protocol, or a git URL.

## Development

```bash
npm install
npm run test:types   # tsc --noEmit over src + tests — the type assertions ARE the tests
npm run build        # emit dist/ with .d.ts (run by you / CI, not during normal dev)
```

The test suite (`tests/types.test-d.ts`) is pure type assertions: if it
compiles, the inference is correct.

## License

MIT
