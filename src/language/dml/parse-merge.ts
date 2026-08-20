import type {
  DropFirstWord,
  ExtractParenGroup,
  FirstWord,
  HasNonTrailingSemicolon,
  IsKeyword,
  Normalize,
  SplitAtTopLevelKeyword,
  SplitColumnList,
  TakeUntilTopLevelKeyword,
  Trim,
  Unquote,
} from '../lexical/string.js';
import type { PredicateIR } from '../ir/predicate.js';
import type { MergeQueryIR } from '../ir/query.js';
import type { DerivedSourceIR, SourceIR } from '../ir/source.js';
import type { MergeActionIR, WriteTargetIR } from '../ir/write.js';
import type { ParseNormalizedFromSources } from '../select/parse-from.js';
import type {
  ParseWriteOutput,
  ParseWriteTarget,
} from './parse-insert.js';
import type { ParseAssignmentList } from './parse-update.js';

type ColumnRow<Columns extends readonly string[]> = {
  [Column in Columns[number]]: unknown;
};

type SourceAliasAndColumns<Rest extends string> =
  FirstWord<Trim<Rest>> extends infer Head extends string
    ? IsKeyword<Head, 'as'> extends true
      ? FirstWord<DropFirstWord<Trim<Rest>>> extends infer Alias extends string
        ? Trim<DropFirstWord<DropFirstWord<Trim<Rest>>>> extends `(${infer AfterOpen}`
          ? ExtractParenGroup<AfterOpen> extends { inner: infer Columns extends string }
            ? { alias: Unquote<Alias>; columns: SplitColumnList<Columns> }
            : never
          : { alias: Unquote<Alias>; columns: [] }
        : never
      : Trim<Rest> extends `${infer Alias} (${infer AfterOpen}`
        ? ExtractParenGroup<AfterOpen> extends { inner: infer Columns extends string }
          ? { alias: Unquote<Trim<Alias>>; columns: SplitColumnList<Columns> }
          : never
        : { alias: Unquote<Head>; columns: [] }
    : never;

type ValuesInside<Sql extends string> = [
  SplitAtTopLevelKeyword<Sql, 'values'>,
] extends [never]
  ? []
  : SplitAtTopLevelKeyword<Sql, 'values'> extends {
      after: infer After extends string;
    }
    ? Trim<After> extends `(${infer AfterOpen}`
      ? ExtractParenGroup<AfterOpen> extends { inner: infer Values extends string }
        ? SplitColumnList<Values>
        : []
      : []
    : [];

type ParseMergeSource<Sql extends string> = Trim<Sql> extends `(${infer AfterOpen}`
  ? ExtractParenGroup<AfterOpen> extends {
      inner: infer Inner extends string;
      rest: infer Rest extends string;
    }
    ? SourceAliasAndColumns<Rest> extends {
        alias: infer Alias extends string;
        columns: infer Columns extends readonly string[];
      }
      ? {
          sources: [DerivedSourceIR<Alias, ColumnRow<Columns>>];
          values: ValuesInside<Inner>;
        }
      : { sources: []; values: [] }
    : { sources: []; values: [] }
  : ParseNormalizedFromSources<Sql> extends {
      sources: infer Sources extends readonly SourceIR[];
    }
    ? { sources: Sources; values: [] }
    : { sources: []; values: [] };

type ParseInsertAction<Sql extends string> = Trim<
  DropFirstWord<Trim<Sql>>
> extends `(${infer AfterOpen}`
  ? ExtractParenGroup<AfterOpen> extends {
      inner: infer Columns extends string;
      rest: infer Rest extends string;
    }
    ? SplitAtTopLevelKeyword<Rest, 'values'> extends {
        after: infer AfterValues extends string;
      }
      ? Trim<AfterValues> extends `(${infer ValuesOpen}`
        ? ExtractParenGroup<ValuesOpen> extends { inner: infer Values extends string }
          ? {
              kind: 'insert';
              columns: SplitColumnList<Columns>;
              values: SplitColumnList<Values>;
            }
          : { kind: 'insert'; columns: SplitColumnList<Columns>; values: [] }
        : { kind: 'insert'; columns: SplitColumnList<Columns>; values: [] }
      : { kind: 'insert'; columns: SplitColumnList<Columns>; values: [] }
    : { kind: 'insert'; columns: []; values: [] }
  : { kind: 'insert'; columns: []; values: [] };

type ParseAction<Clause extends string> = [
  SplitAtTopLevelKeyword<Clause, 'then'>,
] extends [never]
  ? never
  : SplitAtTopLevelKeyword<Clause, 'then'> extends {
      after: infer Action extends string;
    }
    ? FirstWord<Trim<Action>> extends infer Kind extends string
      ? IsKeyword<Kind, 'update'> extends true
        ? SplitAtTopLevelKeyword<Action, 'set'> extends {
            after: infer Assignments extends string;
          }
          ? {
              kind: 'update';
              assignments: ParseAssignmentList<Assignments>;
            }
          : { kind: 'update'; assignments: [] }
        : IsKeyword<Kind, 'insert'> extends true
          ? ParseInsertAction<Action>
          : IsKeyword<Kind, 'delete'> extends true
            ? { kind: 'delete' }
            : never
      : never
    : never;

type ParseActions<
  Sql extends string,
  Result extends readonly MergeActionIR[] = [],
> = SplitAtTopLevelKeyword<Sql, 'when'> extends infer Next
  ? [Next] extends [never]
    ? ParseAction<TakeUntilTopLevelKeyword<Sql, 'output'>> extends infer Action
      ? Action extends MergeActionIR
        ? [...Result, Action]
        : Result
      : Result
    : Next extends {
        before: infer Current extends string;
        after: infer Rest extends string;
      }
      ? ParseAction<Current> extends infer Action
        ? Action extends MergeActionIR
          ? ParseActions<Rest, [...Result, Action]>
          : ParseActions<Rest, Result>
        : Result
      : Result
  : Result;

type MalformedMerge<Sql extends string> = {
  code: 'MALFORMED_QUERY';
  message: 'malformed MERGE query';
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

type ParseFatal<Sql extends string, Error = MalformedMerge<Sql>> = {
  kind: 'fatal';
  readonly __value?: MergeQueryIR;
  diagnostics: [Error];
};

type BuildMerge<
  Sql extends string,
  TargetText extends string,
  AfterUsing extends string,
> = ParseWriteTarget<TargetText, 'using'> extends {
  target: infer Target extends WriteTargetIR;
}
  ? SplitAtTopLevelKeyword<AfterUsing, 'on'> extends {
      before: infer SourceText extends string;
      after: infer AfterOn extends string;
    }
    ? SplitAtTopLevelKeyword<AfterOn, 'when'> extends {
        before: infer On extends string;
        after: infer Actions extends string;
      }
      ? ParseMergeSource<SourceText> extends {
          sources: infer Sources extends readonly SourceIR[];
          values: infer Values extends readonly string[];
        }
        ? {
            kind: 'ok';
            value: MergeQueryIR<
              Target,
              Sources,
              [PredicateIR<'join-on', On>],
              ParseActions<Actions>,
              ParseWriteOutput<Sql>,
              Values
            >;
            diagnostics: [];
          }
        : ParseFatal<Sql>
      : ParseFatal<Sql>
    : ParseFatal<Sql>
  : ParseFatal<Sql>;

type ParseNormalized<Sql extends string> = Sql extends `${infer Merge} ${infer Rest}`
  ? IsKeyword<Merge, 'merge'> extends true
    ? Rest extends `${infer Into} ${infer AfterInto}`
      ? IsKeyword<Into, 'into'> extends true
        ? SplitAtTopLevelKeyword<AfterInto, 'using'> extends {
            before: infer Target extends string;
            after: infer AfterUsing extends string;
          }
          ? BuildMerge<Sql, Target, AfterUsing>
          : ParseFatal<Sql>
        : ParseFatal<Sql>
      : ParseFatal<Sql>
    : ParseFatal<Sql>
  : ParseFatal<Sql>;

export type ParseMergeIR<Sql extends string> = HasNonTrailingSemicolon<Sql> extends true
  ? ParseFatal<Sql, MultipleStatements<Sql>>
  : ParseNormalized<Normalize<Sql>>;
