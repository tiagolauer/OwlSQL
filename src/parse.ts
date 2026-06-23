import type {
  Normalize,
  Trim,
  FirstWord,
  StripQualifier,
  IsKeyword,
} from './string.js';
import type {
  IsFunctionCall,
  FunctionOutputName,
  FunctionReturnType,
} from './functions.js';

export type Schema = Record<string, Record<string, unknown>>;

export type SchemaLike = object;

export type QueryTypeError<Message extends string> = {
  readonly __sqlTypeError: Message;
};

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

type AfterKeyword<S extends string, Keyword extends string> =
  S extends `${infer Head} ${infer Tail}`
    ? IsKeyword<Head, Keyword> extends true
      ? Tail
      : AfterKeyword<Tail, Keyword>
    : never;

type WordAfterKeyword<S extends string, Keyword extends string> =
  AfterKeyword<S, Keyword> extends infer Rest
    ? Rest extends string
      ? FirstWord<Rest>
      : ''
    : '';

type ReturningColumns<S extends string> = AfterKeyword<S, 'returning'> extends infer Rest
  ? Rest extends string
    ? Rest
    : ''
  : '';

export interface ParsedSelect {
  columns: string;
  table: string;
}

type ParseSelectBody<S extends string> = StatementAfterSelect<S> extends infer Body
  ? Body extends string
    ? ColumnsBeforeFrom<Body> extends {
        columns: infer Columns extends string;
        afterFrom: infer AfterFrom extends string;
      }
      ? { columns: Columns; table: FirstWord<AfterFrom> }
      : never
    : never
  : never;

type ParseStatementNormalized<S extends string> = FirstWord<S> extends infer Keyword extends string
  ? IsKeyword<Keyword, 'select'> extends true
    ? ParseSelectBody<S>
    : IsKeyword<Keyword, 'insert'> extends true
      ? { columns: ReturningColumns<S>; table: WordAfterKeyword<S, 'into'> }
      : IsKeyword<Keyword, 'update'> extends true
        ? { columns: ReturningColumns<S>; table: WordAfterKeyword<S, 'update'> }
        : IsKeyword<Keyword, 'delete'> extends true
          ? { columns: ReturningColumns<S>; table: WordAfterKeyword<S, 'from'> }
          : never
  : never;

export type ParseStatement<S extends string> = ParseStatementNormalized<Normalize<S>>;

export type ParseSelect<S extends string> = ParseSelectBody<Normalize<S>>;

type SplitColumnList<S extends string> = S extends `${infer Head},${infer Tail}`
  ? [Trim<Head>, ...SplitColumnList<Tail>]
  : [Trim<S>];

type OutputName<Expression extends string> = IsFunctionCall<Expression> extends true
  ? FunctionOutputName<Expression>
  : StripQualifier<Expression>;

type ParseColumnEntry<Entry extends string> =
  Entry extends `${infer Expression} ${infer Middle} ${infer Alias}`
    ? IsKeyword<Middle, 'as'> extends true
      ? [Trim<Alias>, Trim<Expression>]
      : [OutputName<Entry>, Entry]
    : Entry extends `${infer Expression} ${infer Alias}`
      ? [Trim<Alias>, Trim<Expression>]
      : [OutputName<Trim<Entry>>, Trim<Entry>];

type ResolveColumnType<
  DB extends SchemaLike,
  Table extends string,
  Source extends string,
  Strict extends boolean,
> = IsFunctionCall<Source> extends true
  ? FunctionReturnType<Source>
  : Table extends keyof DB
    ? StripQualifier<Source> extends keyof DB[Table]
      ? DB[Table][StripQualifier<Source>]
      : Strict extends true
        ? QueryTypeError<`unknown column: ${Source}`>
        : unknown
    : Strict extends true
      ? QueryTypeError<`unknown table: ${Table}`>
      : unknown;

type RowFromColumnEntries<
  DB extends SchemaLike,
  Table extends string,
  Entries extends [string, string][],
  Strict extends boolean,
> = {
  [Entry in Entries[number] as Entry[0]]: ResolveColumnType<DB, Table, Entry[1], Strict>;
};

type ParseColumnEntries<Columns extends string[]> = {
  [Index in keyof Columns]: ParseColumnEntry<Columns[Index]>;
};

type IsSelectAll<Columns extends string> = Trim<Columns> extends '*' ? true : false;

type StarRow<
  DB extends SchemaLike,
  Table extends string,
  Strict extends boolean,
> = Table extends keyof DB
  ? { [Column in keyof DB[Table]]: DB[Table][Column] }
  : Strict extends true
    ? QueryTypeError<`unknown table: ${Table}`>
    : unknown;

type CollectRowErrors<Row> = {
  [Key in keyof Row]: Row[Key] extends QueryTypeError<infer Message>
    ? QueryTypeError<Message>
    : never;
}[keyof Row];

type SurfaceErrors<Row> = [CollectRowErrors<Row>] extends [never] ? Row : CollectRowErrors<Row>;

type BuildRow<
  DB extends SchemaLike,
  Table extends string,
  Entries extends [string, string][],
  Strict extends boolean,
> = Strict extends true
  ? SurfaceErrors<RowFromColumnEntries<DB, Table, Entries, true>>
  : RowFromColumnEntries<DB, Table, Entries, false>;

type EmptyRow = Record<string, never>;

type InferRowWith<
  DB extends SchemaLike,
  Q extends string,
  Strict extends boolean,
> = ParseStatement<Q> extends {
  columns: infer Columns extends string;
  table: infer Table extends string;
}
  ? Trim<Columns> extends ''
    ? EmptyRow
    : IsSelectAll<Columns> extends true
      ? StarRow<DB, Table, Strict>
      : BuildRow<
          DB,
          Table,
          ParseColumnEntries<SplitColumnList<Columns>> extends [string, string][]
            ? ParseColumnEntries<SplitColumnList<Columns>>
            : [],
          Strict
        >
  : never;

export type InferRow<DB extends SchemaLike, Q extends string> = InferRowWith<DB, Q, false>;

export type InferRowStrict<DB extends SchemaLike, Q extends string> = InferRowWith<DB, Q, true>;

export type InferResult<DB extends SchemaLike, Q extends string> = InferRow<DB, Q>[];

export type InferResultStrict<DB extends SchemaLike, Q extends string> = InferRowStrict<DB, Q>[];
