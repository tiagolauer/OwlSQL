import type {
  BeforeParen,
  DropFirstWord,
  ExtractParenGroup,
  FirstWord,
  HasNonTrailingSemicolon,
  IsKeyword,
  Normalize,
  SplitAtTopLevelKeyword,
  SplitColumnList,
  StripQualifier,
  TakeUntilTopLevelKeyword,
  Trim,
  Unquote,
} from '../lexical/string.js';
import type {
  InsertDefaultValuesIR,
  InsertQueryIR,
  InsertSelectIR,
  InsertValuesIR,
  SelectQueryIR,
} from '../ir/query.js';
import type { OutputIR, WriteTargetIR } from '../ir/write.js';
import type { ParseProjectionList } from '../select/parse-projection.js';
import type { ParseSelectIR } from '../select/parse-select.js';

type InsertBoundary =
  | 'values'
  | 'value'
  | 'select'
  | 'default'
  | 'output'
  | 'returning';

type IsWriteBoundary<
  Token extends string,
  Boundary extends string,
> = Lowercase<Token> extends Lowercase<Boundary>
  ? true
  : false;

type CleanTarget<Token extends string> = Unquote<StripQualifier<BeforeParen<Token>>>;

type RestAfterTarget<Sql extends string> = FirstWord<Trim<Sql>> extends `${string}(${string}`
  ? Trim<Sql> extends `${string}(${infer AfterOpen}`
    ? `(${AfterOpen}`
    : ''
  : Trim<DropFirstWord<Trim<Sql>>>;

export type ParseWriteTarget<
  AfterInto extends string,
  Boundary extends string,
> = CleanTarget<
  FirstWord<Trim<AfterInto>>
> extends infer Name extends string
  ? RestAfterTarget<AfterInto> extends infer Rest extends string
    ? Trim<Rest> extends `(${string}` | ''
      ? { target: WriteTargetIR<Name>; rest: Rest }
      : FirstWord<Rest> extends infer Head extends string
        ? IsKeyword<Head, 'as'> extends true
          ? FirstWord<DropFirstWord<Rest>> extends infer Alias extends string
            ? {
                target: WriteTargetIR<Name, CleanTarget<Alias>>;
                rest: Trim<DropFirstWord<DropFirstWord<Rest>>>;
              }
            : never
          : IsWriteBoundary<Head, Boundary> extends true
            ? { target: WriteTargetIR<Name>; rest: Rest }
            : {
                target: WriteTargetIR<Name, CleanTarget<Head>>;
                rest: Trim<DropFirstWord<Rest>>;
              }
        : never
    : never
  : never;

type ColumnParts<Rest extends string> = Trim<Rest> extends `(${infer AfterOpen}`
  ? ExtractParenGroup<AfterOpen> extends {
      inner: infer Columns extends string;
      rest: infer Tail extends string;
    }
    ? { columns: SplitColumnList<Columns>; rest: Trim<Tail> }
    : { columns: []; rest: Rest }
  : { columns: []; rest: Rest };

type ParseValueRows<
  Sql extends string,
  Rows extends readonly (readonly string[])[] = [],
> = Trim<Sql> extends `(${infer AfterOpen}`
  ? ExtractParenGroup<AfterOpen> extends {
      inner: infer Values extends string;
      rest: infer Rest extends string;
    }
    ? Trim<Rest> extends `,${infer Tail}`
      ? ParseValueRows<Tail, [...Rows, SplitColumnList<Values>]>
      : { rows: [...Rows, SplitColumnList<Values>]; rest: Trim<Rest> }
    : { rows: Rows; rest: Trim<Sql> }
  : { rows: Rows; rest: Trim<Sql> };

type BeforeClause<Sql extends string, Keyword extends string> = [
  SplitAtTopLevelKeyword<Sql, Keyword>,
] extends [never]
  ? Sql
  : SplitAtTopLevelKeyword<Sql, Keyword> extends {
      before: infer Before extends string;
    }
    ? Before
    : Sql;

type BeforeOutputClauses<Sql extends string> = BeforeClause<
  BeforeClause<Sql, 'returning'>,
  'output'
>;

type StripPseudoQualifier<Entry extends string> = Lowercase<
  Entry extends `${infer Qualifier}.${string}` ? Trim<Qualifier> : ''
> extends 'inserted' | 'deleted'
  ? Entry extends `${string}.${infer Column}`
    ? Trim<Column>
    : Entry
  : Entry;

type StripPseudoQualifiers<
  Entries extends readonly string[],
  Result extends string[] = [],
> = Entries extends readonly [
  infer Head extends string,
  ...infer Tail extends string[],
]
  ? StripPseudoQualifiers<Tail, [...Result, StripPseudoQualifier<Head>]>
  : Result;

type JoinEntries<Entries extends readonly string[]> = Entries extends readonly [
  infer Head extends string,
  ...infer Tail extends string[],
]
  ? Tail extends []
    ? Head
    : `${Head},${JoinEntries<Tail>}`
  : '';

type OutputText<Sql extends string> = [
  SplitAtTopLevelKeyword<Sql, 'returning'>,
] extends [never]
  ? [SplitAtTopLevelKeyword<Sql, 'output'>] extends [never]
    ? { mode: 'none'; text: '' }
    : SplitAtTopLevelKeyword<Sql, 'output'> extends {
        after: infer After extends string;
      }
      ? { mode: 'output'; text: BeforeClause<After, 'values'> }
      : { mode: 'none'; text: '' }
  : SplitAtTopLevelKeyword<Sql, 'returning'> extends {
      after: infer After extends string;
    }
    ? { mode: 'returning'; text: After }
    : { mode: 'none'; text: '' };

export type ParseWriteOutput<
  Sql extends string,
  StopKeyword extends string = never,
> = OutputText<Sql> extends {
  mode: infer Mode extends 'none' | 'returning' | 'output';
  text: infer Text extends string;
}
  ? Mode extends 'none'
    ? OutputIR<'none', []>
    : [StopKeyword] extends [never]
      ? OutputIR<
          Mode,
          ParseProjectionList<
            JoinEntries<StripPseudoQualifiers<SplitColumnList<Text>>>
          >
        >
      : OutputIR<
          Mode,
          ParseProjectionList<
            JoinEntries<
              StripPseudoQualifiers<
                SplitColumnList<TakeUntilTopLevelKeyword<Text, StopKeyword>>
              >
            >
          >
        >
  : never;

type ParseSource<Rest extends string> = [
  SplitAtTopLevelKeyword<Rest, 'values'>,
] extends [never]
  ? [SplitAtTopLevelKeyword<Rest, 'select'>] extends [never]
    ? Lowercase<Trim<Rest>> extends `${string}default values${string}`
      ? InsertDefaultValuesIR
      : never
    : SplitAtTopLevelKeyword<Rest, 'select'> extends {
        after: infer SelectBody extends string;
      }
      ? ParseSelectIR<`select ${BeforeOutputClauses<SelectBody>}`> extends {
          kind: 'ok';
          value: infer Query extends SelectQueryIR;
        }
        ? InsertSelectIR<Query>
        : ParseSelectIR<`select ${BeforeOutputClauses<SelectBody>}`>
      : never
  : SplitAtTopLevelKeyword<Rest, 'values'> extends {
      after: infer Values extends string;
    }
    ? ParseValueRows<Values> extends {
        rows: infer Rows extends readonly (readonly string[])[];
        rest: infer Tail extends string;
      }
      ? InsertValuesIR<Rows, BeforeOutputClauses<Tail>>
      : never
    : never;

type MalformedInsert<Sql extends string> = {
  code: 'MALFORMED_QUERY';
  message: 'malformed INSERT query';
  severity: 'fatal';
  location: 'statement';
  reference: Sql;
};

type MultipleStatements<Sql extends string> = {
  code: 'MULTIPLE_STATEMENTS';
  message: 'multiple statements are not supported: found a semicolon before the end of the query';
  severity: 'fatal';
  location: 'statement';
  reference: Sql;
};

type ParseFatal<Sql extends string, Error = MalformedInsert<Sql>> = {
  kind: 'fatal';
  readonly __value?: InsertQueryIR;
  diagnostics: [Error];
};

type BuildInsert<Sql extends string, AfterInto extends string> =
  ParseWriteTarget<AfterInto, InsertBoundary> extends {
    target: infer Target extends WriteTargetIR;
    rest: infer Rest extends string;
  }
    ? ColumnParts<Rest> extends {
        columns: infer Columns extends readonly string[];
        rest: infer Body extends string;
      }
      ? ParseSource<Body> extends infer Source
        ? Source extends InsertValuesIR | InsertSelectIR | InsertDefaultValuesIR
          ? {
              kind: 'ok';
              value: InsertQueryIR<Target, Columns, Source, ParseWriteOutput<Sql, 'values'>>;
              diagnostics: [];
            }
          : Source extends {
                kind: 'fatal';
                diagnostics: infer Diagnostics;
              }
            ? {
                kind: 'fatal';
                readonly __value?: InsertQueryIR;
                diagnostics: Diagnostics;
              }
            : ParseFatal<Sql>
        : never
      : ParseFatal<Sql>
    : ParseFatal<Sql>;

type ParseNormalized<Sql extends string> = Sql extends `${infer Insert} ${infer Rest}`
  ? IsKeyword<Insert, 'insert'> extends true
    ? Rest extends `${infer Into} ${infer AfterInto}`
      ? IsKeyword<Into, 'into'> extends true
        ? BuildInsert<Sql, AfterInto>
        : ParseFatal<Sql>
      : ParseFatal<Sql>
    : ParseFatal<Sql>
  : ParseFatal<Sql>;

export type ParseInsertIR<Sql extends string> = HasNonTrailingSemicolon<Sql> extends true
  ? ParseFatal<Sql, MultipleStatements<Sql>>
  : ParseNormalized<Normalize<Sql>>;
