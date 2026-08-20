import type {
  Trim,
  FirstWord,
  DropFirstWord,
  IsKeyword,
  ExtractParenGroup,
  SplitColumnList,
} from './language/lexical/string.js';
import type { SchemaLike, Flatten, QueryTypeError, SelectColumnKeys, ShadowedBy } from './parse.js';
import type { InferRowWith } from './parse.js';

type CteEntry = [name: string, query: string, columns: string[] | null];

type CteNameAndRest<S extends string> = S extends `${infer NamePart}(${infer AfterOpen}`
  ? NamePart extends `${string} ${string}`
    ? { name: FirstWord<S>; columns: null; rest: Trim<DropFirstWord<S>> }
    : ExtractParenGroup<AfterOpen> extends {
          inner: infer Cols extends string;
          rest: infer Rest extends string;
        }
      ? { name: Trim<NamePart>; columns: SplitColumnList<Cols>; rest: Trim<Rest> }
      : never
  : { name: FirstWord<S>; columns: null; rest: Trim<DropFirstWord<S>> };

// `AS MATERIALIZED (...)` and `AS NOT MATERIALIZED (...)` are Postgres 12+
// planner hints sitting between `as` and the body. Requiring the paren to
// follow `as` directly rejected the whole WITH clause over them (issue #283).
// Nothing else reads the hint: it changes how the CTE is executed, not what
// it returns.
type SkipMaterializedKeyword<S extends string> = IsKeyword<FirstWord<S>, 'materialized'> extends true
  ? Trim<DropFirstWord<S>>
  : IsKeyword<FirstWord<S>, 'not'> extends true
    ? IsKeyword<FirstWord<Trim<DropFirstWord<S>>>, 'materialized'> extends true
      ? Trim<DropFirstWord<Trim<DropFirstWord<S>>>>
      : S
    : S;

type ParseCteEntry<S extends string> = CteNameAndRest<Trim<S>> extends {
  name: infer Name extends string;
  columns: infer Columns extends string[] | null;
  rest: infer Rest extends string;
}
  ? IsKeyword<FirstWord<Rest>, 'as'> extends true
    ? SkipMaterializedKeyword<Trim<DropFirstWord<Rest>>> extends `(${infer AfterOpen}`
      ? ExtractParenGroup<AfterOpen> extends { inner: infer SubQuery extends string; rest: infer AfterQuery extends string }
        ? { name: Name; columns: Columns; query: Trim<SubQuery>; rest: Trim<AfterQuery> }
        : never
      : never
    : never
  : never;

type ParseCteList<S extends string, Accumulated extends CteEntry[] = []> =
  ParseCteEntry<S> extends {
    name: infer Name extends string;
    columns: infer Columns extends string[] | null;
    query: infer Query extends string;
    rest: infer Rest extends string;
  }
    ? Rest extends `,${infer After}`
      ? ParseCteList<Trim<After>, [...Accumulated, [Name, Query, Columns]]>
      : { ctes: [...Accumulated, [Name, Query, Columns]]; rest: Rest }
    : never;

type SkipRecursiveKeyword<S extends string> = IsKeyword<FirstWord<S>, 'recursive'> extends true
  ? Trim<DropFirstWord<S>>
  : S;

// The [never] guard is load-bearing: ParseCteList resolves to never for a WITH
// clause it cannot read, and `never extends { ctes: infer C extends
// CteEntry[]; rest: infer R extends string }` passes with both infers falling
// back to their constraints. That handed ResolveCteContext a `rest` of
// `string` instead of a clean failure, and the query degraded into an index
// signature row rather than reporting anything (issue #283).
export type ParseWithClause<S extends string> = IsKeyword<FirstWord<S>, 'with'> extends true
  ? [ParseCteList<SkipRecursiveKeyword<Trim<DropFirstWord<S>>>>] extends [never]
    ? never
    : ParseCteList<SkipRecursiveKeyword<Trim<DropFirstWord<S>>>> extends {
          ctes: infer Ctes extends CteEntry[];
          rest: infer Rest extends string;
        }
      ? { ctes: Ctes; rest: Rest }
      : never
  : never;

type RenameKeys<Row, Keys extends string[], NewNames extends string[]> = NewNames extends [
  infer NewName extends string,
  ...infer NewTail extends string[],
]
  ? Keys extends [infer OldKey extends string, ...infer OldTail extends string[]]
    ? { [Key in NewName]: OldKey extends keyof Row ? Row[OldKey] : unknown } & RenameKeys<
        Row,
        OldTail,
        NewTail
      >
    : Record<never, never>
  : Record<never, never>;

type CteRow<
  DB extends SchemaLike,
  Query extends string,
  Columns extends string[] | null,
  Strict extends boolean,
> = Flatten<InferRowWith<DB, Query, Strict>> extends infer Row
  ? Columns extends string[]
    ? Row extends QueryTypeError<string>
      ? Row
      : SelectColumnKeys<Query> extends infer Keys extends string[]
        ? [Keys] extends [never]
          ? Row
          : Flatten<RenameKeys<Row, Keys, Columns>>
        : Row
    : Row
  : never;

export type BuildCteMap<
  DB extends SchemaLike,
  Ctes extends CteEntry[],
  Strict extends boolean,
  Accumulated extends Record<string, unknown> = Record<never, never>,
> = Ctes extends [infer Head extends CteEntry, ...infer Tail extends CteEntry[]]
  ? BuildCteMap<
      DB,
      Tail,
      Strict,
      Accumulated & { [Key in Head[0]]: CteRow<ShadowedBy<DB, Accumulated>, Head[1], Head[2], Strict> }
    >
  : Accumulated;
