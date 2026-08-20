# ADR-010: Derive parameters from shallow IR fragments

Status: Accepted
Date: 2026-08-20

## Context

The SELECT Query IR carried a `parameters` collection that every Language parser left empty. Parameter inference already consumes projection, predicate, clause, assignment, value, and output fragments after Language has delimited them.

## Decision

Do not keep an unpopulated Parameter IR in v1. Parse each statement once into shallow Query IR, then derive parameter identity and expected types from the fragments owned by that IR. Public output and parameter projections consume the same classified parse result.

## Consequences

Language remains responsible for statement structure, while Compiler owns schema-aware parameter resolution. Reintroducing a dedicated Parameter IR requires evidence that it reduces compiler cost or semantic duplication and must populate every supported statement form.
