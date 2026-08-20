# ADR-004: Structured diagnostics

Status: Accepted
Date: 2026-08-15

## Context

Compiler errors currently rely too heavily on incidental `never` behavior.

## Decision

Produce structured internal diagnostics and apply strictness as a policy after compilation.

## Alternatives considered

Use `never` as the semantic error representation or build a second strict compiler.

## Consequences

Errors can be classified, localized, propagated, and projected compatibly through `QueryTypeError`.
