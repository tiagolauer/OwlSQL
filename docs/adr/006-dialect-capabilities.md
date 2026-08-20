# ADR-006: Dialect capabilities

Status: Accepted
Date: 2026-08-15

## Context

OwlSQL supports multiple SQL dialects with shared semantics.

## Decision

Use common SQL grammar plus isolated dialect capabilities and extensions.

## Alternatives considered

Fork complete parsers per dialect.

## Consequences

Shared behavior remains centralized and dialect coverage is explicit and testable.
