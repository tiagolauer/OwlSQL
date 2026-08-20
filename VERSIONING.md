# Versioning policy

OwlSQL follows [Semantic Versioning](https://semver.org). This document says what that means for a library whose main output is types rather than runtime behavior, because the usual reading ("the runtime API didn't change, so it's a patch") would let a release break every build that depends on it.

This policy takes effect at 1.0. Before then, the `0.x` rules apply: minor bumps may break anything.

## What the public API is

Three surfaces, all covered:

1. **Runtime exports** — everything in the [API reference](README.md#api-reference): `createTypedDb`, the `Result` helpers, the adapter factories on each subpath, `defineSchema`.
2. **Inferred types** — the type `Query<DB, Q>`, `Row`, `StrictQuery`, `StrictRow`, and `Params` resolve to for a given schema and query string. This is the real product. A change here breaks user code the same way deleting a function would, and is treated the same way.
3. **The CLI contract** — `owlsql generate`'s flags, its exit codes, and the TypeScript it emits for a given database schema.

## Classification

| Change | Bump |
| ------ | ---- |
| Bug fix with no effect on inferred types or runtime behavior | patch |
| Performance work (fewer type instantiations, faster CLI) | patch |
| A query that failed to parse now parses and types correctly | minor |
| New SQL syntax, new adapter, new CLI flag, new export | minor |
| A column that resolved to `unknown` now resolves to a concrete type | minor |
| Strict mode reports a mistake it previously let through | minor |
| A generated column type is corrected to match what the driver really returns | minor |
| A row shape changes: a key added, removed, renamed, or retyped | **major** |
| A `Params` tuple changes arity or element types | **major** |
| A query that used to type now produces a `QueryTypeError` (outside strict mode) | **major** |
| A runtime export is removed, renamed, or its signature narrowed | **major** |
| The minimum supported Node or TypeScript version rises | **major** |

The three "minor" rows in the middle are the ones that need justifying, because each of them can turn a green build red. They are spelled out below.

### `unknown` becoming a concrete type

Turning `unknown` into a known type is the entire purpose of this library, so freezing every `unknown` until the next major would mean the library can only improve once a year.

An `unknown` in an inferred row is a statement that OwlSQL could not work out the type — not a promise that it never will. Code that consumed it had to narrow or cast to use it at all, and narrowing still compiles once the type gets more specific. Code that assigned it somewhere `unknown` was accepted keeps compiling too.

The case this does break is a cast that was wrong: `row.total as number` when the column is really `string`. That was already a latent runtime bug; the release surfaces it. That's an acceptable trade for the alternative, and it's why these land in the changelog under a heading of their own.

### Strict mode gaining new diagnostics

`{ strict: true }` is an opt-in request to be told about mistakes. Its coverage has grown over time — the `SELECT` list first, then `WHERE`, then `JOIN ... ON` — and each step turned queries that previously compiled into compile errors.

Freezing that coverage at 1.0 would make strict mode a snapshot of what the parser happened to validate on release day. So: **new strict-mode diagnostics ship in minor releases**, and the changelog calls out every one under a `Strict mode` heading so an upgrade that lights up your editor is never a surprise.

The escape hatch is the mode itself. Non-strict inference is frozen by the table above: nothing in a minor release turns a passing non-strict query into a `QueryTypeError`. A project that cannot absorb new diagnostics on a minor upgrade can pin the version or drop strict mode for the file in question.

This applies to strict mode's *own* checks. A new `QueryTypeError` for something that is invalid SQL in both modes — a second statement after a semicolon, a multi-column scalar subquery — is a breaking change and waits for a major.

### Corrected type mappings in `owlsql generate`

When the generated schema said `boolean` and the driver actually hands back a `number`, the generated type was wrong, and every project that trusted it had a bug the type system was actively hiding. Correcting it changes the emitted `schema.ts` and can break a build.

Those corrections ship as minor releases, listed individually in the changelog with the old and new type. A mapping change that is a matter of preference rather than correctness — one defensible type swapped for another — is a major.

Re-running `owlsql generate` is always required after upgrading across a release that lists one, and `owlsql generate --check` in CI is the intended way to notice.

## TypeScript and Node support

The supported ranges are the ones declared in `peerDependencies` and `engines`. Both are tested in CI on every commit.

- Adding support for a newer TypeScript or Node is a minor.
- Dropping a version from either supported range is a major.
- A new TypeScript release breaking inference that used to work is a **bug**, fixed in a patch. New TypeScript versions ship their own breaking changes; absorbing them is this library's problem, not a reason to bump anything here.

The editor plugin is a separate package, [`@owlsql/ts-plugin`](ts-plugin/README.md), with its own version and its own narrower TypeScript range. This policy does not cover it, and it is deliberately staying on `0.x`: it is built on the classic TypeScript compiler API, whose availability is decided upstream, so it is in no position to promise stability. Keeping the two apart is what lets this package support TypeScript 7 while the plugin cannot.

## Not covered

No compatibility guarantee, changeable in any release:

- The message text inside `QueryTypeError<...>`. Match on the presence of the error, never on its wording.
- CLI human-readable output — progress lines, error phrasing, help text. Exit codes *are* covered.
- Compile-time cost. The [type-instantiation budget](CONTRIBUTING.md#the-type-instantiation-budget) exists to keep this honest, but a release may legitimately raise it.

## Deprecation

A runtime export slated for removal is deprecated in at least one minor release before it goes, with a `@deprecated` JSDoc tag naming the replacement, and stays working for that whole period. Removal happens in the next major.

Inferred types can't carry a deprecation tag, so a planned change to a row shape is announced in the changelog of the preceding minor instead.

## Release checklist

1. Every user-visible change has a `CHANGELOG.md` entry, with `Strict mode` and `Type mapping` as their own headings when either applies.
2. `npm test` (types across the supported TypeScript matrix, plus runtime), `npm run test:integration`, and `npm run test:perf` all pass.
3. If `MAX_INSTANTIATIONS` moved, the changelog says by how much and why.
4. `npm version <patch|minor|major>` picks the bump using the table above, not by how large the diff feels.
