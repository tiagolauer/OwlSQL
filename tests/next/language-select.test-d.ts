import type { SelectClausesIR, SelectQueryIR } from '../../src/language/ir/query.js';
import type { ColumnProjectionIR } from '../../src/language/ir/projection.js';
import type { TableSourceIR } from '../../src/language/ir/source.js';
import type { ClassifyStatement } from '../../src/language/lexical/statement.js';
import type { ParseSelectIR } from '../../src/language/select/parse-select.js';
import type { CompileOk } from '../../src/compiler/contracts/compilation.js';

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends
  (<T>() => T extends B ? 1 : 2) ? true : false;

type Expect<T extends true> = T;

type Expected = SelectQueryIR<
  [TableSourceIR<'users', 'u', false>],
  [ColumnProjectionIR<'u', 'id', 'id'>],
  [],
  [],
  []
>;

declare const expected: Expected;
void expected;

type _statement = Expect<Equal<ClassifyStatement<' SELECT id FROM users '>, 'select'>>;

type _simple = Expect<
  Equal<
    ParseSelectIR<'select id, name from users'>,
    CompileOk<
      SelectQueryIR<
        [TableSourceIR<'users', 'users'>],
        [
          ColumnProjectionIR<null, 'id', 'id'>,
          ColumnProjectionIR<null, 'name', 'name'>,
        ],
        [],
        [],
        [],
        SelectClausesIR,
        []
      >
    >
  >
>;

type _qualified = Expect<
  Equal<
    ParseSelectIR<'select u.id as user_id from users as u'>,
    CompileOk<
      SelectQueryIR<
        [TableSourceIR<'users', 'u'>],
        [ColumnProjectionIR<'u', 'id', 'user_id'>],
        [],
        [],
        [],
        SelectClausesIR,
        []
      >
    >
  >
>;

type _malformed = Expect<
  ParseSelectIR<'select from users'> extends {
    kind: 'fatal';
    diagnostics: [{ code: 'MALFORMED_QUERY' }];
  }
    ? true
    : false
>;
