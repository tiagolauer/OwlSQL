# ADR-009: SQL string ownership at compiler boundaries

Status: Accepted
Date: 2026-08-20

## Context

Raw SQL is the product input, while full-query structural interpretation belongs to Language. Public inference types still need a string entrypoint, and compiler semantics operate on expression and predicate fragments preserved in shallow Query IR.

## Decision

Public and compiler statement entrypoints may accept a complete SQL string only to classify it through Language and invoke one matching Language parser. Semantic compilation then consumes Query IR. Compiler code may interpret expression, predicate, assignment, and parameter fragments already delimited by that IR, but must not split or rescan the complete statement structure.

Runtime adapter scanners may recognize placeholders and quoted regions solely to bind driver parameters. They do not infer, rewrite, or structurally parse SQL.

## Consequences

Language remains the single owner of statement structure. Compiler wrappers preserve the string-based public API without creating a second parser. Any new whole-statement scan outside Language requires an ADR that supersedes this decision.
