# ADR-005: Runtime/compiler isolation

Status: Accepted
Date: 2026-08-15

## Context

Runtime execution must remain driver-independent and free of compile-time SQL machinery.

## Decision

Runtime contracts and adapters must not depend on Language or Compiler modules.

## Alternatives considered

Keep execution and inference in the same implementation module.

## Consequences

Runtime can evolve and be tested independently from type-level inference.
