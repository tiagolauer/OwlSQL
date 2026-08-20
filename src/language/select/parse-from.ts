import type {
  ApplyParenDelta,
  DropFirstWord,
  ExtractParenGroup,
  FirstWord,
  IsKeyword,
  Normalize,
  SplitColumnList,
  StripQualifier,
  Trim,
  Unquote,
} from '../../string.js';
import type { PredicateIR } from '../ir/predicate.js';
import type { SelectQueryIR } from '../ir/query.js';
import type {
  DerivedSourceIR,
  JoinKind,
  SourceIR,
  TableSourceIR,
} from '../ir/source.js';
import type { ParseSelectIR } from './parse-select.js';

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
  | 'for'
  | 'returning'
  | 'output';

type IsBoundary<Word extends string> = Lowercase<Word> extends ClauseBoundary
  ? true
  : false;

type SplitFromBoundary<
  Sql extends string,
  Depth extends unknown[] = [],
  Before extends string = '',
> = Sql extends `${infer Head} ${infer Tail}`
  ? Depth extends []
    ? IsBoundary<Head> extends true
      ? { clause: Trim<Before>; rest: Trim<`${Head} ${Tail}`> }
      : SplitFromBoundary<
          Tail,
          ApplyParenDelta<Depth, Head>,
          Before extends '' ? Head : `${Before} ${Head}`
        >
    : SplitFromBoundary<
        Tail,
        ApplyParenDelta<Depth, Head>,
        Before extends '' ? Head : `${Before} ${Head}`
      >
  : Depth extends []
    ? IsBoundary<Sql> extends true
      ? { clause: Trim<Before>; rest: Trim<Sql> }
      : { clause: Trim<Before extends '' ? Sql : `${Before} ${Sql}`>; rest: '' }
    : { clause: Trim<Before extends '' ? Sql : `${Before} ${Sql}`>; rest: '' };

type JoinAfterOuter<
  Tail extends string,
  Kind extends JoinKind,
> = IsKeyword<FirstWord<Tail>, 'join'> extends true
  ? { kind: Kind; rest: DropFirstWord<Tail> }
  : IsKeyword<FirstWord<Tail>, 'outer'> extends true
    ? IsKeyword<FirstWord<DropFirstWord<Tail>>, 'join'> extends true
      ? { kind: Kind; rest: DropFirstWord<DropFirstWord<Tail>> }
      : never
    : never;

type JoinPhrase<Head extends string, Tail extends string> =
  IsKeyword<Head, 'join'> extends true
    ? { kind: 'inner'; rest: Tail }
    : IsKeyword<Head, 'inner'> extends true
      ? IsKeyword<FirstWord<Tail>, 'join'> extends true
        ? { kind: 'inner'; rest: DropFirstWord<Tail> }
        : never
      : IsKeyword<Head, 'cross'> extends true
        ? IsKeyword<FirstWord<Tail>, 'join'> extends true
          ? { kind: 'cross'; rest: DropFirstWord<Tail> }
          : never
        : IsKeyword<Head, 'left'> extends true
          ? JoinAfterOuter<Tail, 'left'>
          : IsKeyword<Head, 'right'> extends true
            ? JoinAfterOuter<Tail, 'right'>
            : IsKeyword<Head, 'full'> extends true
              ? JoinAfterOuter<Tail, 'full'>
              : never;

type SplitAtJoin<
  Sql extends string,
  Depth extends unknown[] = [],
  Before extends string = '',
> = Sql extends `${infer Head} ${infer Tail}`
  ? Depth extends []
    ? JoinPhrase<Head, Tail> extends infer Phrase
      ? [Phrase] extends [never]
        ? SplitAtJoin<
            Tail,
            ApplyParenDelta<Depth, Head>,
            Before extends '' ? Head : `${Before} ${Head}`
          >
        : Phrase extends {
              kind: infer Kind extends JoinKind;
              rest: infer Rest extends string;
            }
          ? { before: Trim<Before>; kind: Kind; after: Rest }
          : never
      : never
    : SplitAtJoin<
        Tail,
        ApplyParenDelta<Depth, Head>,
        Before extends '' ? Head : `${Before} ${Head}`
      >
  : never;

type AliasOf<Segment extends string, Table extends string> =
  DropFirstWord<Segment> extends ''
    ? Table
    : FirstWord<DropFirstWord<Segment>> extends infer Next extends string
      ? IsKeyword<Next, 'on' | 'using'> extends true
        ? Table
        : IsKeyword<Next, 'as'> extends true
          ? FirstWord<DropFirstWord<DropFirstWord<Segment>>> extends infer Alias extends string
            ? Alias extends ''
              ? Table
              : Alias
            : Table
          : Next
      : Table;

type DerivedAlias<Rest extends string> = Trim<Rest> extends ''
  ? never
  : IsKeyword<FirstWord<Trim<Rest>>, 'as'> extends true
    ? FirstWord<DropFirstWord<Trim<Rest>>>
    : IsKeyword<FirstWord<Trim<Rest>>, 'on'> extends true
      ? never
      : FirstWord<Trim<Rest>>;

type StripLateral<Segment extends string> = Trim<Segment> extends `${infer Head} ${infer Rest}`
  ? IsKeyword<Head, 'lateral'> extends true
    ? Trim<Rest>
    : Trim<Segment>
  : Trim<Segment>;

type UsingColumns<Segment extends string> = Segment extends `${infer Head} ${infer Tail}`
  ? IsKeyword<Head, 'using'> extends true
    ? Trim<Tail> extends `(${infer AfterOpen}`
      ? ExtractParenGroup<AfterOpen> extends { inner: infer Inner extends string }
        ? SplitColumnList<Inner>
        : []
      : []
    : UsingColumns<Tail>
  : [];

type IsNullable<Kind extends JoinKind> = Kind extends 'left' | 'full'
  ? true
  : false;

type DerivedSource<
  Segment extends string,
  Kind extends JoinKind,
> = StripLateral<Segment> extends `(${infer AfterOpen}`
  ? ExtractParenGroup<AfterOpen> extends {
      inner: infer Query extends string;
      rest: infer Rest extends string;
    }
    ? DerivedAlias<Rest> extends infer Alias extends string
      ? ParseSelectIR<Trim<Query>> extends {
          kind: 'ok';
          value: infer Nested extends SelectQueryIR;
        }
        ? DerivedSourceIR<Unquote<Alias>, Nested, IsNullable<Kind>, Kind>
        : never
      : never
    : never
  : never;

type TableSource<
  Segment extends string,
  Kind extends JoinKind,
> = Unquote<StripQualifier<FirstWord<Segment>>> extends infer Table extends string
  ? TableSourceIR<
      Table,
      Unquote<AliasOf<Segment, Table>>,
      IsNullable<Kind>,
      Kind,
      UsingColumns<Segment>
    >
  : never;

type SegmentSource<
  Segment extends string,
  Kind extends JoinKind,
> = StripLateral<Segment> extends `(${string}`
  ? DerivedSource<Segment, Kind>
  : TableSource<Segment, Kind>;

type SegmentSources<
  Segment extends string,
  Kind extends JoinKind,
  Parts extends readonly string[] = SplitColumnList<Segment>,
> = Parts extends readonly [
  infer Head extends string,
  ...infer Tail extends string[],
]
  ? [SegmentSource<Head, Kind>, ...SegmentSources<Segment, Kind, Tail>]
  : [];

type SplitAtOn<
  Sql extends string,
  Depth extends unknown[] = [],
> = Sql extends `${infer Head} ${infer Tail}`
  ? Depth extends []
    ? IsKeyword<Head, 'on'> extends true
      ? Trim<Tail>
      : SplitAtOn<Tail, ApplyParenDelta<Depth, Head>>
    : SplitAtOn<Tail, ApplyParenDelta<Depth, Head>>
  : never;

type SegmentPredicates<Segment extends string> =
  SplitAtOn<Segment> extends infer Fragment
    ? [Fragment] extends [never]
      ? []
      : Fragment extends string
        ? [PredicateIR<'join-on', Fragment>]
        : []
    : [];

type MarkNullable<Sources extends readonly SourceIR[]> = {
  [Index in keyof Sources]: Sources[Index] extends TableSourceIR<
    infer Name,
    infer Alias,
    boolean,
    infer Join,
    infer Merged
  >
    ? TableSourceIR<Name, Alias, true, Join, Merged>
    : Sources[Index] extends DerivedSourceIR<
          infer Alias,
          infer Query,
          boolean,
          infer Join
        >
      ? DerivedSourceIR<Alias, Query, true, Join>
      : never;
};

type NullablePrevious<
  Kind extends JoinKind,
  Sources extends readonly SourceIR[],
> = Kind extends 'right' | 'full' ? MarkNullable<Sources> : Sources;

type CollectJoined<
  Sql extends string,
  CurrentKind extends JoinKind,
  Sources extends readonly SourceIR[],
  Predicates extends readonly PredicateIR[],
> = SplitAtJoin<Sql> extends infer Split
  ? [Split] extends [never]
    ? {
        sources: [...Sources, ...SegmentSources<Sql, CurrentKind>];
        predicates: [...Predicates, ...SegmentPredicates<Sql>];
      }
    : Split extends {
          before: infer Before extends string;
          kind: infer NextKind extends JoinKind;
          after: infer After extends string;
        }
      ? CollectJoined<
          After,
          NextKind,
          NullablePrevious<
            NextKind,
            [...Sources, ...SegmentSources<Before, CurrentKind>]
          >,
          [...Predicates, ...SegmentPredicates<Before>]
        >
      : never
  : never;

type ParseClause<Clause extends string> = SplitAtJoin<Clause> extends infer Split
  ? [Split] extends [never]
    ? { sources: SegmentSources<Clause, 'root'>; predicates: [] }
    : Split extends {
          before: infer Before extends string;
          kind: infer Kind extends JoinKind;
          after: infer After extends string;
        }
      ? CollectJoined<
          After,
          Kind,
          NullablePrevious<Kind, SegmentSources<Before, 'root'>>,
          []
        >
      : never
  : never;

type ParseNormalized<Sql extends string> =
  SplitFromBoundary<Sql> extends {
    clause: infer Clause extends string;
    rest: infer Rest extends string;
  }
    ? ParseClause<Clause> extends {
        sources: infer Sources extends readonly SourceIR[];
        predicates: infer Predicates extends readonly PredicateIR[];
      }
      ? { sources: Sources; predicates: Predicates; rest: Rest }
      : never
    : never;

export type ParseFromSources<Sql extends string> = ParseNormalized<Normalize<Sql>>;

export type ParseNormalizedFromSources<Sql extends string> = ParseNormalized<Sql>;

export type ParseRootSource<Sql extends string> =
  ParseFromSources<Sql>['sources'] extends readonly [infer Root extends SourceIR]
    ? Root
    : never;
