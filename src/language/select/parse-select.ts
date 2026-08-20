import type {
  ApplyParenDelta,
  DropFirstWord,
  FirstWord,
  IsKeyword,
  Normalize,
  Trim,
} from '../../string.js';
import type {
  SelectClausesIR,
  SelectQueryIR,
  SetOperationIR,
} from '../ir/query.js';
import type { PredicateIR } from '../ir/predicate.js';
import type { SourceIR } from '../ir/source.js';
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

type BuildSelect<
  Sources extends readonly SourceIR[],
  Projection extends string,
  Predicates extends readonly PredicateIR[],
  Tail extends string,
> = ParseSelectTail<Tail> extends {
  predicates: infer TailPredicates extends readonly PredicateIR[];
  clauses: infer Clauses extends SelectClausesIR<
    string,
    string,
    string,
    string,
    string
  >;
}
  ? {
      kind: 'ok';
      value: SelectQueryIR<
        Sources,
        ParseProjectionList<Projection>,
        [...Predicates, ...TailPredicates],
        [],
        [],
        Clauses,
        []
      >;
      diagnostics: [];
    }
  : never;

type ParseBody<Body extends string, Sql extends string> =
  [SplitAtFrom<Body>] extends [never]
    ? SplitProjectionTail<Body> extends {
        projection: infer Projection extends string;
        rest: infer Tail extends string;
      }
      ? Projection extends ''
        ? ParseFatal<Sql>
        : BuildSelect<[], Projection, [], Tail>
      : ParseFatal<Sql>
    : SplitAtFrom<Body> extends {
        before: infer Projection extends string;
        after: infer Source extends string;
      }
      ? Projection extends ''
      ? ParseFatal<Sql>
        : ParseNormalizedFromSources<Source> extends {
            sources: infer Sources extends readonly SourceIR[];
            predicates: infer Predicates extends readonly PredicateIR[];
            rest: infer Tail extends string;
          }
          ? Sources extends readonly []
            ? ParseFatal<Sql>
            : BuildSelect<Sources, Projection, Predicates, Tail>
          : ParseFatal<Sql>
      : ParseFatal<Sql>;

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
    infer Parameters,
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
          Parameters,
          Ctes,
          Clauses,
          [...SetOperations, SetOperationIR<Kind, BranchIR>]
        >;
        diagnostics: [];
      }
    : Branch
  : Parsed;

type ParseSetBody<Body extends string, Sql extends string> =
  [SplitAtSet<Body>] extends [never]
    ? ParseBody<Body, Sql>
    : SplitAtSet<Body> extends {
        primary: infer Primary extends string;
        kind: infer Kind extends SetOperationIR['kind'];
        branch: infer Branch extends string;
      }
      ? AddSetOperation<
          ParseBody<Primary, Sql>,
          Kind,
          ParseNormalized<Branch, Branch>
        >
      : ParseFatal<Sql>;

type ParseNormalized<Normalized extends string, Sql extends string> =
  Normalized extends `${infer Select} ${infer Body}`
    ? IsKeyword<Select, 'select'> extends true
      ? ParseSetBody<Body, Sql>
      : ParseFatal<Sql>
    : ParseFatal<Sql>;

export type ParseSelectIR<Sql extends string> = ParseNormalized<Normalize<Sql>, Sql>;
