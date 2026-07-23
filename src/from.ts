import type {
  Trim,
  FirstWord,
  DropFirstWord,
  IsKeyword,
  Unquote,
  StripQualifier,
  ExtractParenGroup,
  ApplyParenDelta,
  SplitColumnList,
} from './string.js';

export interface Source {
  table: string;
  alias: string;
  nullable: boolean;
  derivedQuery?: string;
}

type ClauseBoundary =
  | 'where'
  | 'group'
  | 'order'
  | 'limit'
  | 'having'
  | 'offset'
  | 'fetch'
  | 'window'
  | 'union'
  | 'except'
  | 'intersect'
  | 'for';

type IsBoundary<Word extends string> = Lowercase<Word> extends ClauseBoundary
  ? true
  : false;

type SplitFromClauseBoundary<
  S extends string,
  Depth extends unknown[] = [],
  Accumulated extends string = '',
> = S extends `${infer Head} ${infer Tail}`
  ? Depth extends []
    ? IsBoundary<Head> extends true
      ? { clause: Trim<Accumulated>; rest: Trim<`${Head} ${Tail}`> }
      : SplitFromClauseBoundary<Tail, ApplyParenDelta<Depth, Head>, Accumulated extends '' ? Head : `${Accumulated} ${Head}`>
    : SplitFromClauseBoundary<Tail, ApplyParenDelta<Depth, Head>, Accumulated extends '' ? Head : `${Accumulated} ${Head}`>
  : Depth extends []
    ? IsBoundary<S> extends true
      ? { clause: Trim<Accumulated>; rest: Trim<S> }
      : { clause: Trim<Accumulated extends '' ? S : `${Accumulated} ${S}`>; rest: '' }
    : { clause: Trim<Accumulated extends '' ? S : `${Accumulated} ${S}`>; rest: '' };

type TakeFromClause<S extends string> = SplitFromClauseBoundary<S>['clause'];

export type RestAfterFromClause<AfterFrom extends string> = SplitFromClauseBoundary<AfterFrom>['rest'];

export type TakeUntilClauseBoundary<S extends string> = SplitFromClauseBoundary<S>['clause'];

type JoinAfterOuter<
  Tail extends string,
  Joined extends boolean,
  Prev extends boolean,
> = IsKeyword<FirstWord<Tail>, 'join'> extends true
  ? { joined: Joined; prev: Prev; rest: DropFirstWord<Tail> }
  : IsKeyword<FirstWord<Tail>, 'outer'> extends true
    ? IsKeyword<FirstWord<DropFirstWord<Tail>>, 'join'> extends true
      ? { joined: Joined; prev: Prev; rest: DropFirstWord<DropFirstWord<Tail>> }
      : never
    : never;

type JoinPhrase<Head extends string, Tail extends string> =
  IsKeyword<Head, 'join'> extends true
    ? { joined: false; prev: false; rest: Tail }
    : IsKeyword<Head, 'inner'> extends true
      ? IsKeyword<FirstWord<Tail>, 'join'> extends true
        ? { joined: false; prev: false; rest: DropFirstWord<Tail> }
        : never
      : IsKeyword<Head, 'cross'> extends true
        ? IsKeyword<FirstWord<Tail>, 'join'> extends true
          ? { joined: false; prev: false; rest: DropFirstWord<Tail> }
          : never
        : IsKeyword<Head, 'left'> extends true
          ? JoinAfterOuter<Tail, true, false>
          : IsKeyword<Head, 'right'> extends true
            ? JoinAfterOuter<Tail, false, true>
            : IsKeyword<Head, 'full'> extends true
              ? JoinAfterOuter<Tail, true, true>
              : never;

type SplitAtFirstJoin<
  S extends string,
  Depth extends unknown[] = [],
  Accumulated extends string = '',
> = S extends `${infer Head} ${infer Tail}`
  ? Depth extends []
    ? JoinPhrase<Head, Tail> extends infer Phrase
      ? [Phrase] extends [never]
        ? SplitAtFirstJoin<Tail, ApplyParenDelta<Depth, Head>, Accumulated extends '' ? Head : `${Accumulated} ${Head}`>
        : Phrase extends {
              joined: infer Joined extends boolean;
              prev: infer Prev extends boolean;
              rest: infer Rest extends string;
            }
          ? { before: Trim<Accumulated>; joined: Joined; prev: Prev; after: Rest }
          : never
      : never
    : SplitAtFirstJoin<Tail, ApplyParenDelta<Depth, Head>, Accumulated extends '' ? Head : `${Accumulated} ${Head}`>
  : never;

type AliasOf<Segment extends string, Table extends string> =
  DropFirstWord<Segment> extends ''
    ? Table
    : FirstWord<DropFirstWord<Segment>> extends infer Next extends string
      ? IsKeyword<Next, 'on'> extends true
        ? Table
        : IsKeyword<Next, 'as'> extends true
          ? FirstWord<DropFirstWord<DropFirstWord<Segment>>> extends infer Aliased extends string
            ? Aliased extends ''
              ? Table
              : Aliased
            : Table
          : Next
      : Table;

type CleanIdentifier<Raw extends string> = Unquote<StripQualifier<Raw>>;

type DerivedAlias<Rest extends string> = Trim<Rest> extends ''
  ? never
  : IsKeyword<FirstWord<Trim<Rest>>, 'as'> extends true
    ? FirstWord<DropFirstWord<Trim<Rest>>>
    : IsKeyword<FirstWord<Trim<Rest>>, 'on'> extends true
      ? never
      : FirstWord<Trim<Rest>>;

type DerivedSegmentToSource<Segment extends string, Nullable extends boolean> = Trim<Segment> extends `(${infer AfterOpen}`
  ? ExtractParenGroup<AfterOpen> extends { inner: infer SubQuery extends string; rest: infer Rest extends string }
    ? [DerivedAlias<Rest>] extends [never]
      ? never
      : {
          table: DerivedAlias<Rest>;
          alias: DerivedAlias<Rest>;
          nullable: Nullable;
          derivedQuery: Trim<SubQuery>;
        }
    : never
  : never;

// `LATERAL` attaches directly to a derived-table subquery ("join lateral
// (select ...) alias on ..."), so it has to be stripped before the "does
// this segment start with a paren" check below - otherwise the keyword
// itself gets read as the table name and the real alias is lost.
type StripLateral<Segment extends string> = Trim<Segment> extends `${infer Head} ${infer Rest}`
  ? IsKeyword<Head, 'lateral'> extends true
    ? Trim<Rest>
    : Trim<Segment>
  : Trim<Segment>;

type SegmentToSource<Segment extends string, Nullable extends boolean> = StripLateral<Segment> extends `(${string}`
  ? DerivedSegmentToSource<StripLateral<Segment>, Nullable>
  : CleanIdentifier<FirstWord<Segment>> extends infer Table extends string
    ? {
        table: Table;
        alias: Unquote<AliasOf<Segment, Table>>;
        nullable: Nullable;
      }
    : never;

type PartsToSources<Parts extends string[], Nullable extends boolean> = Parts extends [
  infer Head extends string,
  ...infer Tail extends string[],
]
  ? [SegmentToSource<Head, Nullable>, ...PartsToSources<Tail, Nullable>]
  : [];

type SegmentToSources<Segment extends string, Nullable extends boolean> = PartsToSources<
  SplitColumnList<Segment>,
  Nullable
>;

type MarkNullable<Sources extends Source[]> = {
  [Index in keyof Sources]: Sources[Index] extends { derivedQuery: infer Q extends string }
    ? { table: Sources[Index]['table']; alias: Sources[Index]['alias']; nullable: true; derivedQuery: Q }
    : { table: Sources[Index]['table']; alias: Sources[Index]['alias']; nullable: true };
};

type CollectSources<
  S extends string,
  Nullable extends boolean,
  Accumulated extends Source[] = [],
> = SplitAtFirstJoin<S> extends infer Split
  ? [Split] extends [never]
    ? [...Accumulated, ...SegmentToSources<S, Nullable>]
    : Split extends {
          before: infer Before extends string;
          joined: infer Joined extends boolean;
          prev: infer Prev extends boolean;
          after: infer After extends string;
        }
      ? Prev extends true
        ? CollectSources<
            After,
            Joined,
            [...MarkNullable<Accumulated>, ...SegmentToSources<Before, true>]
          >
        : CollectSources<After, Joined, [...Accumulated, ...SegmentToSources<Before, Nullable>]>
      : [...Accumulated, ...SegmentToSources<S, Nullable>]
  : never;

export type ParseFromClause<AfterFrom extends string> = CollectSources<
  TakeFromClause<AfterFrom>,
  false
>;
