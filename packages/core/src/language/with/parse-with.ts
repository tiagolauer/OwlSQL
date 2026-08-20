import type {
  DropFirstWord,
  ExtractParenGroup,
  FirstWord,
  IsKeyword,
  Normalize,
  SplitColumnList,
  Trim,
} from '../lexical/string.js';
import type { StatementKind } from '../lexical/statement.js';
import type { AnyCteIR, CteIR } from '../ir/cte.js';
import type { AnyQueryIR, SelectQueryIR } from '../ir/query.js';
import type { ParseDeleteIR } from '../dml/parse-delete.js';
import type { ParseInsertIR } from '../dml/parse-insert.js';
import type { ParseMergeIR } from '../dml/parse-merge.js';
import type { ParseUpdateIR } from '../dml/parse-update.js';
import type { ParseSelectIR } from '../select/parse-select.js';

export interface WithQueryIR<
  Ctes extends readonly AnyCteIR[] = readonly AnyCteIR[],
  Query extends AnyQueryIR = AnyQueryIR,
> {
  kind: 'with';
  ctes: Ctes;
  query: Query;
}

type MalformedWith<Sql extends string> = {
  code: 'MALFORMED_QUERY';
  message: 'malformed WITH query';
  severity: 'fatal';
  location: 'statement';
  reference: Sql;
};

type ParseMain<Sql extends string> = StatementKind<Sql> extends 'select'
  ? ParseSelectIR<Sql>
  : StatementKind<Sql> extends 'insert'
    ? ParseInsertIR<Sql>
    : StatementKind<Sql> extends 'update'
      ? ParseUpdateIR<Sql>
      : StatementKind<Sql> extends 'delete'
        ? ParseDeleteIR<Sql>
        : StatementKind<Sql> extends 'merge'
          ? ParseMergeIR<Sql>
          : ParseFatal<Sql>;

type ParseFatal<Sql extends string> = {
  kind: 'fatal';
  readonly __value?: WithQueryIR;
  diagnostics: [MalformedWith<Sql>];
};

type CteNameAndRest<Sql extends string> = Sql extends `${infer NamePart}(${infer AfterOpen}`
  ? NamePart extends `${string} ${string}`
    ? {
        name: FirstWord<Sql>;
        columns: null;
        rest: Trim<DropFirstWord<Sql>>;
      }
    : ExtractParenGroup<AfterOpen> extends {
          inner: infer Columns extends string;
          rest: infer Rest extends string;
        }
      ? {
          name: Trim<NamePart>;
          columns: SplitColumnList<Columns>;
          rest: Trim<Rest>;
        }
      : never
  : {
      name: FirstWord<Sql>;
      columns: null;
      rest: Trim<DropFirstWord<Sql>>;
    };

type SkipMaterialization<Sql extends string> = IsKeyword<
  FirstWord<Sql>,
  'materialized'
> extends true
  ? Trim<DropFirstWord<Sql>>
  : IsKeyword<FirstWord<Sql>, 'not'> extends true
    ? IsKeyword<FirstWord<Trim<DropFirstWord<Sql>>>, 'materialized'> extends true
      ? Trim<DropFirstWord<Trim<DropFirstWord<Sql>>>>
      : Sql
    : Sql;

type ParseCteEntry<
  Sql extends string,
  Recursive extends boolean,
  Whole extends string,
> = CteNameAndRest<Trim<Sql>> extends {
  name: infer Name extends string;
  columns: infer Columns extends readonly string[] | null;
  rest: infer Rest extends string;
}
  ? IsKeyword<FirstWord<Rest>, 'as'> extends true
    ? SkipMaterialization<Trim<DropFirstWord<Rest>>> extends `(${infer AfterOpen}`
      ? ExtractParenGroup<AfterOpen> extends {
          inner: infer Body extends string;
          rest: infer AfterBody extends string;
        }
        ? ParseSelectIR<Trim<Body>> extends infer Parsed
          ? Parsed extends {
              kind: 'ok';
              value: infer Query extends SelectQueryIR;
            }
            ? {
                kind: 'ok';
                cte: CteIR<Name, Columns, Query, Recursive>;
                rest: Trim<AfterBody>;
              }
            : Parsed
          : never
        : ParseFatal<Whole>
      : ParseFatal<Whole>
    : ParseFatal<Whole>
  : ParseFatal<Whole>;

type ParseCteList<
  Sql extends string,
  Recursive extends boolean,
  Whole extends string,
  Ctes extends readonly AnyCteIR[] = [],
> = ParseCteEntry<Sql, Recursive, Whole> extends infer Entry
  ? Entry extends {
      kind: 'ok';
      cte: infer Cte extends AnyCteIR;
      rest: infer Rest extends string;
    }
    ? Rest extends `,${infer Tail}`
      ? ParseCteList<Trim<Tail>, Recursive, Whole, [...Ctes, Cte]>
      : ParseMain<Rest> extends infer Main
        ? Main extends {
            kind: 'ok';
            value: infer Query extends AnyQueryIR;
          }
          ? {
              kind: 'ok';
              value: WithQueryIR<[...Ctes, Cte], Query>;
              diagnostics: [];
            }
          : Main
        : never
    : Entry
  : never;

type ParseWithBody<Sql extends string, Whole extends string> = IsKeyword<
  FirstWord<Sql>,
  'recursive'
> extends true
  ? ParseCteList<Trim<DropFirstWord<Sql>>, true, Whole>
  : ParseCteList<Sql, false, Whole>;

export type ParseWithIR<Sql extends string> = Normalize<Sql> extends `${infer With} ${infer Body}`
  ? IsKeyword<With, 'with'> extends true
    ? ParseWithBody<Body, Sql>
    : ParseFatal<Sql>
  : ParseFatal<Sql>;
