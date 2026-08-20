# ADR-008: Keep Tooling inside the core npm package

Status: Accepted
Date: 2026-08-15

## Context

The `owlsql` binary is published by `@owlsql/core`. A private sibling npm workspace would not be present in the installed core tarball, and the current TypeScript build does not bundle sibling workspaces. Tooling has no independent distribution need.

## Decision

Keep Tooling as an internal architectural boundary at `packages/core/src/tooling/`. Do not export it from `@owlsql/core`.

## Alternatives considered

- publish a third `@owlsql/tooling` package;
- add a bundler or copy pipeline solely to hide a private sibling workspace.

## Consequences

Core can ship the CLI with ordinary `tsc`; Tooling remains independently bounded in source and architecture tests. A future independent product may supersede this ADR.
