import type {
  ApplyParenDelta,
  DropFirstWord,
  FirstWord,
  HasNonTrailingSemicolon,
  IsKeyword,
  Normalize,
  StripQualifier,
  Trim,
  Unquote,
} from '../lexical/string.js';
import type {
  SelectClausesIR,
  SelectQueryIR,
  SetOperationIR,
} from '../ir/query.js';
import type { PredicateIR } from '../ir/predicate.js';
import type { SourceIR, TableSourceIR } from '../ir/source.js';
import type { StripSelectModifiers } from '../dialect/common.js';
import type { ParseNormalizedFromSources } from './parse-from.js';
import type { ParseProjectionList } from './parse-projection.js';
import type { ParseSelectTail } from './parse-predicate.js';

type SplitAtFrom<
  Sql extends string,
  Depth extends unknown[] = [],
  Before extends string = '',
> = Sql extends `${infer Token} ${infer Rest}`
  ? Depth extends []
    ? IsKeyword<Token, 'from'> extends true
      ? { before: Trim<Before>; after: Trim<Rest> }
      : SplitAtFrom<Rest, ApplyParenDelta<Depth, Token>, `${Before} ${Token}`>
    : SplitAtFrom<Rest, ApplyParenDelta<Depth, Token>, `${Before} ${Token}`>
  : never;

type SelectFromSplit<Sql extends string> =
  Lowercase<Sql> extends
    | `${string}(select ${string}`
    | `${string}extract(${string} from ${string}`
    | `${string}trim(${string} from ${string}`
    ? SplitAtFrom<Sql>
    : Sql extends `${infer Before} from ${infer After}`
      ? { before: Trim<Before>; after: Trim<After> }
      : SplitAtFrom<Sql>;

type IsSelectClause<Token extends string> = Lowercase<Token> extends
  | 'where'
  | 'group'
  | 'having'
  | 'order'
  | 'limit'
  | 'offset'
  | 'window'
  ? true
  : false;

type SplitProjectionTail<
  Sql extends string,
  Depth extends unknown[] = [],
  Before extends string = '',
> = Sql extends `${infer Token} ${infer Rest}`
  ? Depth extends []
    ? IsSelectClause<Token> extends true
      ? { projection: Trim<Before>; rest: Trim<`${Token} ${Rest}`> }
      : SplitProjectionTail<
          Rest,
          ApplyParenDelta<Depth, Token>,
          Before extends '' ? Token : `${Before} ${Token}`
        >
    : SplitProjectionTail<
        Rest,
        ApplyParenDelta<Depth, Token>,
        Before extends '' ? Token : `${Before} ${Token}`
      >
  : { projection: Trim<Before extends '' ? Sql : `${Before} ${Sql}`>; rest: '' };

type SetKind<Token extends string> = Lowercase<Token> extends 'union'
  ? 'union'
  : Lowercase<Token> extends 'intersect'
    ? 'intersect'
    : Lowercase<Token> extends 'except'
      ? 'except'
      : never;

type SplitAtSet<
  Sql extends string,
  Depth extends unknown[] = [],
  Before extends string = '',
> = Sql extends `${infer Token} ${infer Rest}`
  ? Depth extends []
    ? SetKind<Token> extends infer Kind
      ? [Kind] extends [never]
        ? SplitAtSet<
            Rest,
            ApplyParenDelta<Depth, Token>,
            Before extends '' ? Token : `${Before} ${Token}`
          >
        : Kind extends 'union'
          ? IsKeyword<FirstWord<Rest>, 'all'> extends true
            ? {
                primary: Trim<Before>;
                kind: 'union-all';
                branch: Trim<DropFirstWord<Rest>>;
              }
            : { primary: Trim<Before>; kind: Kind; branch: Trim<Rest> }
          : Kind extends 'intersect' | 'except'
            ? { primary: Trim<Before>; kind: Kind; branch: Trim<Rest> }
            : never
      : never
    : SplitAtSet<
        Rest,
        ApplyParenDelta<Depth, Token>,
        Before extends '' ? Token : `${Before} ${Token}`
      >
  : never;

type MalformedSelect<Sql extends string> = {
  code: 'MALFORMED_QUERY';
  message: 'malformed SELECT query';
  severity: 'fatal';
  location: 'statement';
  reference: Sql;
};

type ParseFatal<Sql extends string> = {
  kind: 'fatal';
  readonly __value?: SelectQueryIR;
  diagnostics: [MalformedSelect<Sql>];
};

type MultipleStatements<Sql extends string> = {
  code: 'MULTIPLE_STATEMENTS';
  message: 'multiple statements are not supported: found a semicolon before the end of the query';
  severity: 'fatal';
  location: 'statement';
  reference: Sql;
};

type ParseMultipleStatements<Sql extends string> = {
  kind: 'fatal';
  readonly __value?: SelectQueryIR;
  diagnostics: [MultipleStatements<Sql>];
};

type BuiltSelect<
  Sources extends readonly SourceIR[],
  Projection extends string,
  Predicates extends readonly PredicateIR[],
  TailPredicates extends readonly PredicateIR[],
  Clauses extends SelectClausesIR<
    string,
    string,
    string,
    string,
    string
  >,
> = {
  kind: 'ok';
  value: SelectQueryIR<
    Sources,
    ParseProjectionList<Projection>,
    [...Predicates, ...TailPredicates],
    [],
    Clauses,
    []
  >;
  diagnostics: [];
};

type BuildSelect<
  Sources extends readonly SourceIR[],
  Projection extends string,
  Predicates extends readonly PredicateIR[],
  Tail extends string,
> = Tail extends ''
  ? BuiltSelect<Sources, Projection, Predicates, [], SelectClausesIR>
  : ParseSelectTail<Tail> extends {
      predicates: infer TailPredicates extends readonly PredicateIR[];
      clauses: infer Clauses extends SelectClausesIR<
        string,
        string,
        string,
        string,
        string
      >;
    }
    ? BuiltSelect<Sources, Projection, Predicates, TailPredicates, Clauses>
    : never;

type BuildFrom<
  Projection extends string,
  Source extends string,
  Sql extends string,
> = Source extends `${string} ${string}` | `${string},${string}` | `${string}(${string}`
  ? ParseNormalizedFromSources<Source> extends {
      sources: infer Sources extends readonly SourceIR[];
      predicates: infer Predicates extends readonly PredicateIR[];
      rest: infer Tail extends string;
    }
    ? Sources extends readonly []
      ? ParseFatal<Sql>
      : BuildSelect<Sources, Projection, Predicates, Tail>
    : ParseFatal<Sql>
  : Unquote<StripQualifier<Source>> extends infer Name extends string
    ? BuildSelect<[TableSourceIR<Name>], Projection, [], ''>
    : never;

type ParseBody<Body extends string, Sql extends string> =
  SelectFromSplit<Body> extends infer From
    ? [From] extends [never]
      ? SplitProjectionTail<Body> extends {
          projection: infer Projection extends string;
          rest: infer Tail extends string;
        }
        ? Projection extends ''
          ? ParseFatal<Sql>
          : BuildSelect<[], Projection, [], Tail>
        : ParseFatal<Sql>
      : From extends {
          before: infer Projection extends string;
          after: infer Source extends string;
        }
        ? Projection extends ''
          ? ParseFatal<Sql>
          : BuildFrom<Projection, Source, Sql>
        : ParseFatal<Sql>
    : never;

type AddSetOperation<
  Parsed,
  Kind extends SetOperationIR['kind'],
  Branch,
> = Parsed extends {
  kind: 'ok';
  value: SelectQueryIR<
    infer Sources,
    infer Projections,
    infer Predicates,
    infer Ctes,
    infer Clauses,
    infer SetOperations
  >;
}
  ? Branch extends { kind: 'ok'; value: infer BranchIR extends SelectQueryIR }
    ? {
        kind: 'ok';
        value: SelectQueryIR<
          Sources,
          Projections,
          Predicates,
          Ctes,
          Clauses,
          [...SetOperations, SetOperationIR<Kind, BranchIR>]
        >;
        diagnostics: [];
      }
    : Branch
  : Parsed;

type ParseNormalized<Normalized extends string, Sql extends string> =
  SplitAtSet<Normalized> extends infer Set
    ? [Set] extends [never]
      ? Trim<Normalized> extends `(${infer Inner})`
        ? ParseNormalized<Trim<Inner>, Sql>
        : Normalized extends `${infer Select} ${infer Body}`
          ? IsKeyword<Select, 'select'> extends true
            ? ParseBody<StripSelectModifiers<Body>, Sql>
            : ParseFatal<Sql>
          : ParseFatal<Sql>
      : Set extends {
          primary: infer Primary extends string;
          kind: infer Kind extends SetOperationIR['kind'];
          branch: infer Branch extends string;
        }
        ? AddSetOperation<
            ParseNormalized<Primary, Sql>,
            Kind,
            ParseNormalized<Branch, Branch>
          >
        : ParseFatal<Sql>
    : never;

export type ParseSelectIR<Sql extends string> = HasNonTrailingSemicolon<Sql> extends true
  ? ParseMultipleStatements<Sql>
  : ParseNormalized<Normalize<Sql>, Sql>;
