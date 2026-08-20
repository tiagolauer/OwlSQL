# OwlSQL v1 compiler performance budget

The v1 public fixture baseline is 135,217 TypeScript 5.9 instantiations. Its hard ceiling is 150,000, an 11% margin. This replaces the 244,919 baseline and 250,000 ceiling used while Legacy and Next coexisted.

Eight cases compile independently in `npm run test:perf`. Each has a 10% relative regression gate and all stay below an absolute 200,000-instantiation ceiling.

| Case | Tested boundary | Baseline |
| --- | --- | ---: |
| Simple SELECT | 3 projected columns | 64,159 |
| Join | 10 sources | 73,040 |
| CTE | 10 ordered CTEs | 110,622 |
| Correlated subquery | 2 nested subquery levels | 71,258 |
| Projection width | 100 projected columns | 187,382 |
| Placeholders | 100 occurrences across 4 statements, 25 per statement | 101,886 |
| Strict diagnostic | 1 blocking unknown-column diagnostic | 63,105 |
| DML output | INSERT, UPDATE, DELETE, and MERGE output forms | 76,704 |

These are reviewed finite boundaries, not claims of unlimited query depth or width. A 100-placeholder single statement reaches TypeScript's recursion-depth error before the instantiation ceiling on TypeScript 5.6, so v1 guarantees the measured 25-placeholder statement width rather than hiding that boundary.
