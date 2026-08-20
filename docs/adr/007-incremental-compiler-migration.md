# ADR-007: Incremental compiler migration

Status: Accepted
Date: 2026-08-15

## Context

A big-bang compiler rewrite would make parity, review, and release safety difficult.

## Decision

Use a Strangler migration. Legacy and Next may coexist internally, but each user query follows one compiler path.

## Alternatives considered

Rewrite the compiler in one branch or double-compile every query in the public type surface.

## Consequences

Each statement family can cut over after parity, regression, dialect, and performance gates pass.
