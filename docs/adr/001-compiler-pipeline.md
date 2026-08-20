# ADR-001: Compiler pipeline

Status: Accepted
Date: 2026-08-15

## Context

OwlSQL has accumulated parser and inference responsibilities in a monolithic flow.

## Decision

Use a staged compile-time pipeline with Language, shallow Query IR, scopes, semantic resolution, inference, diagnostics, and policy projection.

## Alternatives considered

Keep a monolithic parser or introduce a complete SQL AST.

## Consequences

Responsibilities become localizable while compiler cost remains an explicit constraint.
