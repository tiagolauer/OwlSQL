# OwlSQL Architecture Constitution

1. Raw SQL is the source of truth.
2. `@owlsql/core` performs no runtime SQL parsing.
3. Full-query structural interpretation belongs to the Language layer.
4. Language does not resolve user schemas.
5. Compiler does not own runtime execution.
6. Runtime does not depend on Language or Compiler.
7. Adapters execute SQL and do not infer SQL.
8. Shared SQL semantics stay common; dialect differences are capabilities/extensions.
9. Unsupported SQL is distinct from invalid SQL.
10. Strictness is a diagnostic policy, not a separate compiler.
11. Type-instantiation cost is an architectural constraint.
12. Everything is internal by default unless package exports deliberately expose it.
13. Supported behavior requires executable specification.
14. Legacy-vs-Next parity checks run in tests/CI, never on every user query.
