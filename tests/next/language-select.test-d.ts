import type { SelectQueryIR } from '../../src/language/ir/query.js';
import type { ColumnProjectionIR } from '../../src/language/ir/projection.js';
import type { TableSourceIR } from '../../src/language/ir/source.js';

type Expected = SelectQueryIR<
  [TableSourceIR<'users', 'u', false>],
  [ColumnProjectionIR<'u', 'id', 'id'>],
  [],
  [],
  []
>;

declare const expected: Expected;
void expected;
