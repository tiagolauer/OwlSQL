import type {
  ApplyParenDelta,
  DropFirstWord,
  FirstWord,
  IsKeyword,
  Trim,
} from '../../string.js';
import type { PredicateIR } from '../ir/predicate.js';
import type { SelectClausesIR } from '../ir/query.js';

type ClauseKeyword =
  | 'where'
  | 'group'
  | 'having'
  | 'order'
  | 'limit'
  | 'offset'
  | 'window'
  | 'fetch'
  | 'for';

type IsClauseKeyword<Token extends string> =
  Lowercase<Token> extends ClauseKeyword ? true : false;

type TakeClauseBody<
  Sql extends string,
  Depth extends unknown[] = [],
  Body extends string = '',
> = Sql extends `${infer Head} ${infer Tail}`
  ? Depth extends []
    ? IsClauseKeyword<Head> extends true
      ? { body: Trim<Body>; rest: Trim<`${Head} ${Tail}`> }
      : TakeClauseBody<
          Tail,
          ApplyParenDelta<Depth, Head>,
          Body extends '' ? Head : `${Body} ${Head}`
        >
    : TakeClauseBody<
        Tail,
        ApplyParenDelta<Depth, Head>,
        Body extends '' ? Head : `${Body} ${Head}`
      >
  : { body: Trim<Body extends '' ? Sql : `${Body} ${Sql}`>; rest: '' };

type HasFollowingClause<Sql extends string> = Lowercase<Sql> extends
  | `${string} where ${string}`
  | `${string} group ${string}`
  | `${string} having ${string}`
  | `${string} order ${string}`
  | `${string} limit ${string}`
  | `${string} offset ${string}`
  | `${string} window ${string}`
  | `${string} fetch ${string}`
  | `${string} for ${string}`
  ? true
  : false;

type ClauseBody<Sql extends string> = HasFollowingClause<Sql> extends false
  ? { body: Trim<Sql>; rest: '' }
  : TakeClauseBody<Sql>;

type ParsedClauses<
  Predicates extends readonly PredicateIR[],
  Clauses extends SelectClausesIR<string, string, string, string, string>,
> = {
  predicates: Predicates;
  clauses: Clauses;
};

type ParseTail<
  Sql extends string,
  Predicates extends readonly PredicateIR[] = [],
  GroupBy extends string = '',
  OrderBy extends string = '',
  Limit extends string = '',
  Offset extends string = '',
  Window extends string = '',
> = Trim<Sql> extends ''
  ? ParsedClauses<
      Predicates,
      SelectClausesIR<GroupBy, OrderBy, Limit, Offset, Window>
    >
  : FirstWord<Trim<Sql>> extends infer Keyword extends string
    ? ClauseBody<DropFirstWord<Trim<Sql>>> extends {
        body: infer Body extends string;
        rest: infer Rest extends string;
      }
      ? IsKeyword<Keyword, 'where'> extends true
        ? ParseTail<
            Rest,
            [...Predicates, PredicateIR<'where', Body>],
            GroupBy,
            OrderBy,
            Limit,
            Offset,
            Window
          >
        : IsKeyword<Keyword, 'having'> extends true
          ? ParseTail<
              Rest,
              [...Predicates, PredicateIR<'having', Body>],
              GroupBy,
              OrderBy,
              Limit,
              Offset,
              Window
            >
          : IsKeyword<Keyword, 'group'> extends true
            ? ParseTail<
                Rest,
                Predicates,
                IsKeyword<FirstWord<Body>, 'by'> extends true
                  ? Trim<DropFirstWord<Body>>
                  : Body,
                OrderBy,
                Limit,
                Offset,
                Window
              >
            : IsKeyword<Keyword, 'order'> extends true
              ? ParseTail<
                  Rest,
                  Predicates,
                  GroupBy,
                  IsKeyword<FirstWord<Body>, 'by'> extends true
                    ? Trim<DropFirstWord<Body>>
                    : Body,
                  Limit,
                  Offset,
                  Window
                >
              : IsKeyword<Keyword, 'limit'> extends true
                ? ParseTail<Rest, Predicates, GroupBy, OrderBy, Body, Offset, Window>
                : IsKeyword<Keyword, 'offset'> extends true
                  ? ParseTail<Rest, Predicates, GroupBy, OrderBy, Limit, Body, Window>
                  : IsKeyword<Keyword, 'window'> extends true
                    ? ParseTail<Rest, Predicates, GroupBy, OrderBy, Limit, Offset, Body>
                    : ParseTail<Rest, Predicates, GroupBy, OrderBy, Limit, Offset, Window>
      : never
    : never;

export type ParseSelectTail<Sql extends string> = ParseTail<Sql>;
