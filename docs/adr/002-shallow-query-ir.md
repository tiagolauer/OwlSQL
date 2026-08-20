# ADR-002: Shallow Query IR

Status: Accepted
Date: 2026-08-15

## Context

Full AST construction in template literal types is expensive and unnecessary for supported inference.

## Decision

Use a shallow purpose-built Query IR containing only information required by later compiler phases.

## Alternatives considered

Build a complete SQL-standard AST or keep full-query strings opaque.

## Consequences

Downstream phases reuse structural interpretation without paying for unsupported syntax trees.
