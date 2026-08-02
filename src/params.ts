import type {
  Normalize,
  FirstWord,
  DropFirstWord,
  Trim,
  IsKeyword,
  ExtractParenGroup,
  Digit,
  HasNonTrailingSemicolon,
  MaskQuotedIdentifiers,
  StartsWithIdentifierChar,
} from './string.js';
import type {
  Source,
  SchemaLike,
  ParseStatement,
  ResolveColumnLoose,
  ResolveCteContext,
  ResolveKey,
  AfterKeyword,
  SplitColumnList,
  MultipleStatementsError,
} from './parse.js';
import type { ParseWithClause } from './cte.js';
import type { FunctionName } from './functions.js';

// `@>` and `<@` compare an array or a jsonb value against another of the same
// type, so the bound value carries the column's own type - the same thing `=`
// does. They are listed here so the parameter beside them is typed rather
// than left `unknown` now that they are no longer misread as placeholders.
type Operator = '=' | '<>' | '!=' | '<' | '>' | '<=' | '>=' | '@>' | '<@';

type WordOperator = 'like' | 'ilike' | 'in' | 'between' | 'distinct';

type ForcedNumberKeyword = 'limit' | 'offset';

type IsOperator<Token extends string> = Token extends Operator
  ? true
  : Lowercase<Token> extends WordOperator
    ? true
    : false;

type IsTransparentToken<Token extends string> = Token extends '(' | ')' | ','
  ? true
  : Lowercase<Token> extends 'and' | 'or' | 'not' | 'is' | 'from'
    ? true
    : false;

type StripLeadingParens<S extends string> = S extends `(${infer Rest}`
  ? StripLeadingParens<Rest>
  : S;

type StripTrailingListPunctuation<S extends string> = S extends `${infer Rest})`
  ? StripTrailingListPunctuation<Rest>
  : S extends `${infer Rest},`
    ? StripTrailingListPunctuation<Rest>
    : S;

// `$1::int` is the placeholder `$1` carrying a Postgres cast, not a name -
// without stripping the cast the index is unreadable and the token stops
// binding by position (issue #228).
type StripCast<S extends string> = S extends `${infer Before}::${string}` ? Before : S;

type AfterLastOpenParen<S extends string> = S extends `${string}(${infer After}`
  ? After extends `${string}(${string}`
    ? AfterLastOpenParen<After>
    : After
  : S;

// A placeholder is routinely written inside a call - `lower($1)`, `any($1)`,
// `coalesce($1, 0)`. The scan splits on spaces, so the call is one token and
// stripping only the trailing `)` left `lower($1`, which matches nothing: the
// placeholder vanished and the tuple had no slot for a value the driver still
// demands (issue #244).
//
// Two placeholders inside a single token (`f($1,$2)`, written without the
// space) cannot both get a slot from a one-token scan, so that token is left
// alone rather than handed a made-up single slot - the same "write it with
// spaces" rule the README already states for `where id=$1`.
type StripCallWrapper<S extends string> = S extends `${string}(${string}`
  ? AfterLastOpenParen<S> extends infer Inner extends string
    ? Inner extends `${string},${string}`
      ? S
      : Inner
    : S
  : S;

export type CleanScanToken<S extends string> = StripCast<
  StripCallWrapper<StripTrailingListPunctuation<StripLeadingParens<S>>>
>;

export type CleanColumnToken<S extends string> = StripLeadingParens<S> extends infer Stripped extends string
  ? Stripped extends `${string}(${string}`
    ? Stripped
    : StripTrailingListPunctuation<Stripped>
  : never;

// The body test is what keeps an operator out: `@>` and `?|` start with a
// placeholder prefix but carry no name, so they used to be counted as
// parameters and to report the query as using a placeholder style the
// executor doesn't accept (issue #249). A bare `?` stays a placeholder -
// that is exactly what it is in MySQL and SQLite, and no amount of text
// alone can tell it apart from Postgres's jsonb existence operator.
export type IsPlaceholder<Token extends string> = CleanScanToken<Token> extends '?'
  ? true
  : // MERGE's `$action` is a pseudo-column, not a placeholder - ResolveColumnType
    // already types it as the branch that fired, so counting it here handed the
    // caller an extra parameter slot (issue #231).
    Lowercase<CleanScanToken<Token>> extends '$action'
    ? false
    : CleanScanToken<Token> extends `$$${string}` | `@@${string}`
      ? false
      : CleanScanToken<Token> extends `$${infer Body}`
        ? StartsWithIdentifierChar<Body>
        : CleanScanToken<Token> extends `@${infer Body}`
          ? StartsWithIdentifierChar<Body>
          : // `:name` is the third prefix the node:sqlite adapter binds, and it
            // was the only one the type layer didn't know about (issue #238).
            // A `::` cast never reaches here - CleanScanToken strips it.
            CleanScanToken<Token> extends `:${infer Body}`
            ? StartsWithIdentifierChar<Body>
            : false;

interface DigitCounters {
  '0': [];
  '1': [unknown];
  '2': [unknown, unknown];
  '3': [unknown, unknown, unknown];
  '4': [unknown, unknown, unknown, unknown];
  '5': [unknown, unknown, unknown, unknown, unknown];
  '6': [unknown, unknown, unknown, unknown, unknown, unknown];
  '7': [unknown, unknown, unknown, unknown, unknown, unknown, unknown];
  '8': [unknown, unknown, unknown, unknown, unknown, unknown, unknown, unknown];
  '9': [unknown, unknown, unknown, unknown, unknown, unknown, unknown, unknown, unknown];
}

type TimesTen<Counter extends unknown[]> = [
  ...Counter,
  ...Counter,
  ...Counter,
  ...Counter,
  ...Counter,
  ...Counter,
  ...Counter,
  ...Counter,
  ...Counter,
  ...Counter,
];

type DigitsToCounter<S extends string, Accumulated extends unknown[] = []> =
  S extends `${infer Head}${infer Rest}`
    ? Head extends Digit
      ? DigitsToCounter<Rest, [...TimesTen<Accumulated>, ...DigitCounters[Head & keyof DigitCounters]]>
      : never
    : Accumulated;

// The [never] guard is load-bearing: DigitsToCounter resolves to never for
// anything that isn't all digits (`$1::int`, `$id`), and `never extends
// [unknown, ...infer Position]` passes, which routed those tokens into the
// numbered bucket at a bogus position instead of letting them fall through to
// the named branch below (issue #228).
type PlaceholderPosition<Token extends string> =
  CleanScanToken<Token> extends `$${infer Digits}`
    ? [DigitsToCounter<Digits>] extends [never]
      ? never
      : DigitsToCounter<Digits> extends [unknown, ...infer Position extends unknown[]]
        ? Position
        : never
    : never;

// A bare `?` is never named - each occurrence is a distinct positional slot.
// Anything else that reaches here (a non-numeric `$name`/`@name`) is a real
// name, used as the dedup key: a repeated `@id` must bind once (README), not
// grow a new tuple slot per occurrence.
type PlaceholderName<Token extends string> = CleanScanToken<Token> extends '?'
  ? never
  : CleanScanToken<Token>;

type FindNameIndex<
  Names extends string[],
  Name extends string,
  Position extends unknown[] = [],
> = Names extends [infer Head extends string, ...infer Tail extends string[]]
  ? Head extends Name
    ? Position
    : FindNameIndex<Tail, Name, [...Position, unknown]>
  : never;

type SetSlot<
  Tuple extends unknown[],
  Position extends unknown[],
  Type,
> = Position extends [unknown, ...infer PositionRest extends unknown[]]
  ? Tuple extends [infer Head, ...infer TupleRest extends unknown[]]
    ? [Head, ...SetSlot<TupleRest, PositionRest, Type>]
    : [unknown, ...SetSlot<[], PositionRest, Type>]
  : Tuple extends [infer Head, ...infer TupleRest extends unknown[]]
    ? [Head & Type, ...TupleRest]
    : [Type];

// `= any($1)` / `= all($1)` compare the column against a whole array, so the
// bound value is an array of the column's type, not one of them. Without this
// the fix for #244 would hand the caller a confidently wrong element type for
// the idiomatic Postgres way to bind a list.
type ArrayWrappingFunction = 'any' | 'all' | 'some';

type WrapArrayArgument<T, Token extends string> = Token extends `${string}(${string}`
  ? Lowercase<FunctionName<Token>> extends ArrayWrappingFunction
    ? T[]
    : T
  : T;

type ParamType<
  DB extends SchemaLike,
  Sources extends Source[],
  Column extends string,
  Op extends string,
  Token extends string = '',
> = Lowercase<Op> extends ForcedNumberKeyword
  ? number
  : IsOperator<Op> extends true
    ? WrapArrayArgument<ResolveColumnLoose<DB, Sources, Column>, Token>
    : unknown;

type AddParam<
  Token extends string,
  Type,
  Indexed extends unknown[],
  Sequential extends unknown[],
  SequentialNames extends string[],
> = PlaceholderPosition<Token> extends infer Position
  ? [Position] extends [never]
    ? [PlaceholderName<Token>] extends [never]
      ? // A bare `?` still needs a same-length filler pushed onto
        // SequentialNames, or a later named placeholder's FindNameIndex
        // result (an index into SequentialNames) would no longer line up
        // with that same placeholder's real slot in Sequential. '?' itself
        // is a safe filler: PlaceholderName never resolves to '?', so it can
        // never be produced as a search target and accidentally matched.
        { indexed: Indexed; sequential: [...Sequential, Type]; sequentialNames: [...SequentialNames, '?'] }
      : FindNameIndex<SequentialNames, PlaceholderName<Token>> extends infer Existing
        ? [Existing] extends [never]
          ? {
              indexed: Indexed;
              sequential: [...Sequential, Type];
              sequentialNames: [...SequentialNames, PlaceholderName<Token>];
            }
          : Existing extends unknown[]
            ? {
                indexed: Indexed;
                sequential: SetSlot<Sequential, Existing, Type>;
                sequentialNames: SequentialNames;
              }
            : never
        : never
    : Position extends unknown[]
      ? {
          indexed: SetSlot<Indexed, Position, Type>;
          sequential: Sequential;
          sequentialNames: SequentialNames;
        }
      : never
  : never;

type ScanParamsRaw<
  S extends string,
  DB extends SchemaLike,
  Sources extends Source[],
  PrevPrev extends string = '',
  Prev extends string = '',
  Indexed extends unknown[] = [],
  Sequential extends unknown[] = [],
  SequentialNames extends string[] = [],
> = S extends `${infer Head} ${infer Tail}`
  ? IsPlaceholder<Head> extends true
    ? AddParam<
        Head,
        ParamType<DB, Sources, PrevPrev, Prev, Head>,
        Indexed,
        Sequential,
        SequentialNames
      > extends {
        indexed: infer NextIndexed extends unknown[];
        sequential: infer NextSequential extends unknown[];
        sequentialNames: infer NextSequentialNames extends string[];
      }
      ? ScanParamsRaw<Tail, DB, Sources, PrevPrev, Prev, NextIndexed, NextSequential, NextSequentialNames>
      : never
    : IsTransparentToken<Head> extends true
      ? ScanParamsRaw<Tail, DB, Sources, PrevPrev, Prev, Indexed, Sequential, SequentialNames>
      : ScanParamsRaw<Tail, DB, Sources, Prev, CleanColumnToken<Head>, Indexed, Sequential, SequentialNames>
  : S extends ''
    ? { indexed: Indexed; sequential: Sequential; sequentialNames: SequentialNames }
    : IsPlaceholder<S> extends true
      ? AddParam<S, ParamType<DB, Sources, PrevPrev, Prev, S>, Indexed, Sequential, SequentialNames>
      : { indexed: Indexed; sequential: Sequential; sequentialNames: SequentialNames };

type ScanParams<
  S extends string,
  DB extends SchemaLike,
  Sources extends Source[],
  PrevPrev extends string = '',
  Prev extends string = '',
  Indexed extends unknown[] = [],
  Sequential extends unknown[] = [],
  SequentialNames extends string[] = [],
> = ScanParamsRaw<S, DB, Sources, PrevPrev, Prev, Indexed, Sequential, SequentialNames> extends {
  indexed: infer FinalIndexed extends unknown[];
  sequential: infer FinalSequential extends unknown[];
}
  ? [...FinalIndexed, ...FinalSequential]
  : never;

// The column list starts right after the target name, which is not always a
// word boundary: `insert into users(id, name)` glues it to the table, so
// dropping the first word ate the first column too (issue #245).
type RestAfterTarget<S extends string> = FirstWord<Trim<S>> extends `${string}(${string}`
  ? Trim<S> extends `${string}(${infer AfterOpen}`
    ? `(${AfterOpen}`
    : Trim<DropFirstWord<Trim<S>>>
  : Trim<DropFirstWord<Trim<S>>>;

type InsertColumnList<S extends string> = AfterKeyword<S, 'into'> extends infer AfterInto extends string
  ? RestAfterTarget<AfterInto> extends `(${infer AfterOpen}`
    ? ExtractParenGroup<AfterOpen> extends { inner: infer Cols extends string; rest: infer Rest extends string }
      ? { columns: SplitColumnList<Cols>; rest: Trim<Rest> }
      : never
    : never
  : never;

type ColumnTypeAt<DB extends SchemaLike, Table extends string, Column extends string> = [
  ResolveKey<DB, Table>,
] extends [never]
  ? unknown
  : ResolveKey<DB, Table> extends infer TableKey extends keyof DB
    ? [ResolveKey<DB[TableKey], Column>] extends [never]
      ? unknown
      : ResolveKey<DB[TableKey], Column> extends infer ColumnKey extends keyof DB[TableKey]
        ? DB[TableKey][ColumnKey]
        : unknown
    : unknown;

type MatchInsertValues<
  DB extends SchemaLike,
  Table extends string,
  Columns extends string[],
  Values extends string[],
  Indexed extends unknown[],
  Sequential extends unknown[],
  SequentialNames extends string[],
> = Values extends [infer Head extends string, ...infer ValuesTail extends string[]]
  ? Columns extends [infer ColumnHead extends string, ...infer ColumnsTail extends string[]]
    ? IsPlaceholder<Trim<Head>> extends true
      ? AddParam<
          Trim<Head>,
          ColumnTypeAt<DB, Table, ColumnHead>,
          Indexed,
          Sequential,
          SequentialNames
        > extends {
          indexed: infer NextIndexed extends unknown[];
          sequential: infer NextSequential extends unknown[];
          sequentialNames: infer NextSequentialNames extends string[];
        }
        ? MatchInsertValues<
            DB,
            Table,
            ColumnsTail,
            ValuesTail,
            NextIndexed,
            NextSequential,
            NextSequentialNames
          >
        : never
      : MatchInsertValues<DB, Table, ColumnsTail, ValuesTail, Indexed, Sequential, SequentialNames>
    : { indexed: Indexed; sequential: Sequential; sequentialNames: SequentialNames }
  : { indexed: Indexed; sequential: Sequential; sequentialNames: SequentialNames };

type ScanValuesGroups<
  S extends string,
  DB extends SchemaLike,
  Table extends string,
  Columns extends string[],
  Indexed extends unknown[],
  Sequential extends unknown[],
  SequentialNames extends string[],
> = Trim<S> extends `(${infer AfterOpen}`
  ? ExtractParenGroup<AfterOpen> extends { inner: infer Vals extends string; rest: infer Rest extends string }
    ? MatchInsertValues<
        DB,
        Table,
        Columns,
        SplitColumnList<Vals>,
        Indexed,
        Sequential,
        SequentialNames
      > extends {
        indexed: infer NextIndexed extends unknown[];
        sequential: infer NextSequential extends unknown[];
        sequentialNames: infer NextSequentialNames extends string[];
      }
      ? Trim<Rest> extends `,${infer NextGroup}`
        ? ScanValuesGroups<NextGroup, DB, Table, Columns, NextIndexed, NextSequential, NextSequentialNames>
        : {
            indexed: NextIndexed;
            sequential: NextSequential;
            sequentialNames: NextSequentialNames;
            rest: Trim<Rest>;
          }
      : never
    : { indexed: Indexed; sequential: Sequential; sequentialNames: SequentialNames; rest: Trim<S> }
  : { indexed: Indexed; sequential: Sequential; sequentialNames: SequentialNames; rest: Trim<S> };

type InsertParamTypes<DB extends SchemaLike, Q extends string> = ParseStatement<Q> extends {
  sources: [infer Src extends Source];
}
  ? [InsertColumnList<Q>] extends [never]
    ? unknown[]
    : InsertColumnList<Q> extends { columns: infer Columns extends string[]; rest: infer AfterColumns extends string }
      ? // `AfterValues extends string` is distributive (AfterValues is a naked
        // type parameter), so an INSERT with no VALUES clause - INSERT ...
        // SELECT - collapsed the whole conditional to `never` instead of
        // reaching the unknown[] fallback, leaving a rest parameter that no
        // call can satisfy (issue #230).
        [AfterKeyword<AfterColumns, 'values'>] extends [never]
        ? unknown[]
        : AfterKeyword<AfterColumns, 'values'> extends infer AfterValues
          ? AfterValues extends string
            ? ScanValuesGroups<AfterValues, DB, Src['table'], Columns, [], [], []> extends {
                indexed: infer Indexed extends unknown[];
                sequential: infer Sequential extends unknown[];
                sequentialNames: infer SequentialNames extends string[];
                rest: infer Rest extends string;
              }
              ? ScanParams<Rest, DB, [Src], '', '', Indexed, Sequential, SequentialNames>
              : unknown[]
            : unknown[]
          : unknown[]
      : unknown[]
  : unknown[];

type CteScanEntry = [name: string, query: string, columns: string[] | null];

// The registry threads through every CTE body and on into the outer query,
// rather than each scan starting a fresh one and the results being
// concatenated. A name registry is what dedups a repeated placeholder to one
// slot, so a `@since` written in a CTE body and again outside it used to get
// two slots while the adapters - which dedupe by name over the whole
// statement - bound one value. Every parameter after the duplicate then
// shifted by one: on mssql the next `@name` silently received the duplicated
// value, on node:sqlite the query matched nothing (issue #268).
type CteBodyParamScan<
  DB extends SchemaLike,
  Ctes extends CteScanEntry[],
  Indexed extends unknown[] = [],
  Sequential extends unknown[] = [],
  SequentialNames extends string[] = [],
> = Ctes extends [infer Head extends CteScanEntry, ...infer Tail extends CteScanEntry[]]
  ? [ParseStatement<Head[1]>] extends [never]
    ? CteBodyParamScan<DB, Tail, Indexed, Sequential, SequentialNames>
    : ParseStatement<Head[1]> extends { sources: infer Sources extends Source[] }
      ? ScanParamsRaw<Head[1], DB, Sources, '', '', Indexed, Sequential, SequentialNames> extends {
          indexed: infer NextIndexed extends unknown[];
          sequential: infer NextSequential extends unknown[];
          sequentialNames: infer NextSequentialNames extends string[];
        }
        ? CteBodyParamScan<DB, Tail, NextIndexed, NextSequential, NextSequentialNames>
        : never
      : CteBodyParamScan<DB, Tail, Indexed, Sequential, SequentialNames>
  : { indexed: Indexed; sequential: Sequential; sequentialNames: SequentialNames };

type StripDoubledAt<S extends string> = S extends `${infer Before}@@${infer After}`
  ? StripDoubledAt<`${Before}${After}`>
  : S;

type StripDollarAction<S extends string> = S extends `${infer Before}$action${infer After}`
  ? StripDollarAction<`${Before}${After}`>
  : S;

// A prefix only counts when a name or an index follows it, the same rule
// IsPlaceholder applies per token - otherwise `where tags @> $1` reported the
// `at` style and was rejected against a dollar executor (issue #249).
type HasPrefixedPlaceholder<
  S extends string,
  Prefix extends string,
> = S extends `${string}${Prefix}${infer After}`
  ? StartsWithIdentifierChar<After> extends true
    ? true
    : HasPrefixedPlaceholder<After, Prefix>
  : false;

// `?|` and `?&` are Postgres jsonb operators, not placeholders. A bare `?` is
// a placeholder, since that is what it is in MySQL and SQLite.
type HasQuestionPlaceholder<S extends string> = S extends `${string}?${infer After}`
  ? After extends `|${string}` | `&${string}`
    ? HasQuestionPlaceholder<After>
    : true
  : false;

// Quoted identifiers survive Normalize by design (the parser needs the name),
// so their bodies are masked here before the scan - a column legally named
// "user@id" is not a parameter style.
//
// Lowercased so the `$action` strip is case-insensitive, matching how
// IsMergeActionPseudoColumn resolves it. Case is irrelevant to the three
// characters this scans for, so nothing else is affected.
export type UsedPlaceholderStyles<Q extends string> = Lowercase<
  MaskQuotedIdentifiers<Normalize<Q>>
> extends infer Text extends string
  ?
      | (HasQuestionPlaceholder<Text> extends true ? 'question' : never)
      | (HasPrefixedPlaceholder<StripDollarAction<Text>, '$'> extends true ? 'dollar' : never)
      | (HasPrefixedPlaceholder<StripDoubledAt<Text>, '@'> extends true ? 'at' : never)
  : never;

type OuterAndCteParams<
  DB extends SchemaLike,
  Q extends string,
  CteDB extends SchemaLike,
  EffectiveQuery extends string,
  Sources extends Source[],
> = [ParseWithClause<Normalize<Q>>] extends [never]
  ? ScanParams<EffectiveQuery, CteDB, Sources>
  : ParseWithClause<Normalize<Q>> extends { ctes: infer Ctes extends CteScanEntry[] }
    ? CteBodyParamScan<CteDB, Ctes> extends {
        indexed: infer CteIndexed extends unknown[];
        sequential: infer CteSequential extends unknown[];
        sequentialNames: infer CteSequentialNames extends string[];
      }
      ? // Seeding the outer scan with what the CTE bodies produced replaces the
        // old concatenation: the numbered slots merge at their own positions
        // the way SetSlot already merges a repeat, the sequential ones come
        // out CTE-first in textual order, and a name already registered by a
        // CTE body now resolves to its existing slot instead of a second one.
        ScanParams<
          EffectiveQuery,
          CteDB,
          Sources,
          '',
          '',
          CteIndexed,
          CteSequential,
          CteSequentialNames
        >
      : unknown[]
    : unknown[];

// Same guard InferRowWith applies (issue #206): the parameter tuple is
// derived from the merged text too, so a stacked statement would otherwise
// hand the caller a normal-looking signature covering placeholders from two
// different statements. The error tuple makes the call site fail instead.
export type InferParams<DB extends SchemaLike, Q extends string> =
  HasNonTrailingSemicolon<Q> extends true
    ? [MultipleStatementsError]
    : InferParamsChecked<DB, Q>;

type InferParamsChecked<DB extends SchemaLike, Q extends string> =
  IsKeyword<FirstWord<Normalize<Q>>, 'insert'> extends true
    ? InsertParamTypes<DB, Normalize<Q>>
    : ResolveCteContext<DB, Q, false> extends {
          db: infer CteDB extends SchemaLike;
          query: infer EffectiveQuery extends string;
        }
      ? [ParseStatement<EffectiveQuery>] extends [never]
        ? unknown[]
        : ParseStatement<EffectiveQuery> extends { sources: infer Sources extends Source[] }
          ? OuterAndCteParams<DB, Q, CteDB, EffectiveQuery, Sources>
          : unknown[]
      : unknown[];
