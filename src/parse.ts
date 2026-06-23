import type {
  Normalize,
  Trim,
  FirstWord,
  StripQualifier,
  IsKeyword,
} from './string.js';

export type Schema = Record<string, Record<string, unknown>>;

export type SchemaLike = object;

type StatementAfterSelect<S extends string> = S extends `${infer Keyword} ${infer Rest}`
  ? IsKeyword<Keyword, 'select'> extends true
    ? Rest
    : never
  : never;

type ColumnsBeforeFrom<
  S extends string,
  Accumulated extends string = '',
> = S extends `${infer Head} ${infer Tail}`
  ? IsKeyword<Head, 'from'> extends true
    ? { columns: Trim<Accumulated>; afterFrom: Tail }
    : ColumnsBeforeFrom<Tail, Accumulated extends '' ? Head : `${Accumulated} ${Head}`>
  : IsKeyword<S, 'from'> extends true
    ? { columns: Trim<Accumulated>; afterFrom: '' }
    : never;

export interface ParsedSelect {
  columns: string;
  table: string;
}

type ParseNormalizedSelect<S extends string> = StatementAfterSelect<S> extends infer Body
  ? Body extends string
    ? ColumnsBeforeFrom<Body> extends {
        columns: infer Columns extends string;
        afterFrom: infer AfterFrom extends string;
      }
      ? { columns: Columns; table: FirstWord<AfterFrom> }
      : never
    : never
  : never;

export type ParseSelect<S extends string> = ParseNormalizedSelect<Normalize<S>>;

type SplitColumnList<S extends string> = S extends `${infer Head},${infer Tail}`
  ? [Trim<Head>, ...SplitColumnList<Tail>]
  : [Trim<S>];

type ParseColumnEntry<Entry extends string> =
  Entry extends `${infer Expression} ${infer Middle} ${infer Alias}`
    ? IsKeyword<Middle, 'as'> extends true
      ? [Trim<Alias>, Trim<Expression>]
      : [StripQualifier<Entry>, Entry]
    : Entry extends `${infer Expression} ${infer Alias}`
      ? [Trim<Alias>, Trim<Expression>]
      : [StripQualifier<Trim<Entry>>, Trim<Entry>];

type ColumnType<
  DB extends SchemaLike,
  Table extends string,
  Source extends string,
> = Table extends keyof DB
  ? StripQualifier<Source> extends keyof DB[Table]
    ? DB[Table][StripQualifier<Source>]
    : unknown
  : unknown;

type RowFromColumnEntries<
  DB extends SchemaLike,
  Table extends string,
  Entries extends [string, string][],
> = {
  [Entry in Entries[number] as Entry[0]]: ColumnType<DB, Table, Entry[1]>;
};

type ParseColumnEntries<Columns extends string[]> = {
  [Index in keyof Columns]: ParseColumnEntry<Columns[Index]>;
};

type IsSelectAll<Columns extends string> = Trim<Columns> extends '*' ? true : false;

export type InferRow<DB extends SchemaLike, Q extends string> =
  ParseSelect<Q> extends {
    columns: infer Columns extends string;
    table: infer Table extends string;
  }
    ? IsSelectAll<Columns> extends true
      ? Table extends keyof DB
        ? { [Column in keyof DB[Table]]: DB[Table][Column] }
        : unknown
      : RowFromColumnEntries<
          DB,
          Table,
          ParseColumnEntries<SplitColumnList<Columns>> extends [string, string][]
            ? ParseColumnEntries<SplitColumnList<Columns>>
            : []
        >
    : never;

export type InferResult<DB extends SchemaLike, Q extends string> = InferRow<DB, Q>[];
