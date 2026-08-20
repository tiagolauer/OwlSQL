import type {
  ApplyParenDelta,
  IsKeyword,
  Normalize,
  Trim,
} from '../../string.js';
import type { SelectQueryIR } from '../ir/query.js';
import type { PredicateIR } from '../ir/predicate.js';
import type { SourceIR } from '../ir/source.js';
import type { ParseNormalizedFromSources } from './parse-from.js';
import type { ParseProjectionList } from './parse-projection.js';

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

type ParseBody<Body extends string, Sql extends string> =
  [SplitAtFrom<Body>] extends [never]
    ? Trim<Body> extends ''
      ? ParseFatal<Sql>
      : {
          kind: 'ok';
          value: SelectQueryIR<[], ParseProjectionList<Body>, [], [], []>;
          diagnostics: [];
        }
    : SplitAtFrom<Body> extends {
    before: infer Projection extends string;
    after: infer Source extends string;
  }
    ? Projection extends ''
      ? ParseFatal<Sql>
      : ParseNormalizedFromSources<Source> extends {
          sources: infer Sources extends readonly SourceIR[];
          predicates: infer Predicates extends readonly PredicateIR[];
        }
        ? Sources extends readonly []
          ? ParseFatal<Sql>
          : {
              kind: 'ok';
              value: SelectQueryIR<
                Sources,
                ParseProjectionList<Projection>,
                Predicates,
                [],
                []
              >;
              diagnostics: [];
            }
        : ParseFatal<Sql>
      : ParseFatal<Sql>;

type ParseNormalized<Normalized extends string, Sql extends string> =
  Normalized extends `${infer Select} ${infer Body}`
    ? IsKeyword<Select, 'select'> extends true
      ? ParseBody<Body, Sql>
      : ParseFatal<Sql>
    : ParseFatal<Sql>;

export type ParseSelectIR<Sql extends string> = ParseNormalized<Normalize<Sql>, Sql>;
