# ADR-003: Lexical scopes

Status: Accepted
Date: 2026-08-15

## Context

Nested and correlated queries need explicit visibility and shadowing rules.

## Decision

Represent scopes as local bindings with parent-scope lookup.

## Alternatives considered

Maintain ad hoc outer-source plumbing.

## Consequences

Correlated subqueries, CTE visibility, derived tables, and alias shadowing share one resolution model.
