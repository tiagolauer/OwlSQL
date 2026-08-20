import type {
  DropFirstWord,
  FirstWord,
  HasNonTrailingSemicolon,
  IsKeyword,
  Normalize,
  SplitAtTopLevelKeyword,
  TakeUntilTopLevelKeyword,
  Trim,
} from '../../string.js';
import type { PredicateIR } from '../ir/predicate.js';
import type { DeleteQueryIR } from '../ir/query.js';
import type { SourceIR } from '../ir/source.js';
import type { WriteTargetIR } from '../ir/write.js';
import type { ParseNormalizedFromSources } from '../select/parse-from.js';
import type {
  ParseWriteOutput,
  ParseWriteTarget,
} from './parse-insert.js';

type TargetText<Sql extends string> = TakeUntilTopLevelKeyword<
  Sql,
  'output' | 'using' | 'where' | 'returning'
>;

type UsingSources<Body extends string> = [
  SplitAtTopLevelKeyword<Body, 'using'>,
] extends [never]
  ? { sources: []; predicates: [] }
  : SplitAtTopLevelKeyword<Body, 'using'> extends {
      after: infer After extends string;
    }
    ? ParseNormalizedFromSources<
        TakeUntilTopLevelKeyword<After, 'returning' | 'output'>
      > extends {
        sources: infer Sources;
        predicates: infer Predicates;
      }
      ? { sources: Sources; predicates: Predicates }
      : { sources: []; predicates: [] }
    : { sources: []; predicates: [] };

type WherePredicate<Body extends string> = [
  SplitAtTopLevelKeyword<Body, 'where'>,
] extends [never]
  ? []
  : SplitAtTopLevelKeyword<Body, 'where'> extends {
      after: infer After extends string;
    }
    ? [
        PredicateIR<
          'where',
          TakeUntilTopLevelKeyword<After, 'returning' | 'output'>
        >,
      ]
    : [];

type MalformedDelete<Sql extends string> = {
  code: 'MALFORMED_QUERY';
  message: 'malformed DELETE query';
  severity: 'fatal';
  location: 'statement';
  reference: Sql;
};

type MultipleStatements<Sql extends string> = {
  code: 'MULTIPLE_STATEMENTS';
  message: 'multiple statements are not supported: found a semicolon before the end of the query';
  severity: 'fatal';
  location: 'statement';
  reference: Sql;
};

type ParseFatal<Sql extends string, Error = MalformedDelete<Sql>> = {
  kind: 'fatal';
  readonly __value?: DeleteQueryIR;
  diagnostics: [Error];
};

type BuildDelete<Sql extends string, Body extends string> =
  ParseWriteTarget<
    TargetText<Body>,
    'output' | 'using' | 'where' | 'returning'
  > extends { target: infer Target extends WriteTargetIR }
    ? UsingSources<Body> extends {
        sources: infer Sources extends readonly SourceIR[];
        predicates: infer JoinPredicates extends readonly PredicateIR[];
      }
      ? {
          kind: 'ok';
          value: DeleteQueryIR<
            Target,
            Sources,
            [...JoinPredicates, ...WherePredicate<Body>],
            ParseWriteOutput<Sql, 'where' | 'from'>
          >;
          diagnostics: [];
        }
      : ParseFatal<Sql>
    : ParseFatal<Sql>;

type ParseNormalized<Sql extends string> = FirstWord<Sql> extends infer Delete extends string
  ? IsKeyword<Delete, 'delete'> extends true
    ? DropFirstWord<Sql> extends infer Rest extends string
      ? FirstWord<Rest> extends infer From extends string
        ? IsKeyword<From, 'from'> extends true
          ? BuildDelete<Sql, Trim<DropFirstWord<Rest>>>
          : ParseFatal<Sql>
        : ParseFatal<Sql>
      : ParseFatal<Sql>
    : ParseFatal<Sql>
  : ParseFatal<Sql>;

export type ParseDeleteIR<Sql extends string> = HasNonTrailingSemicolon<Sql> extends true
  ? ParseFatal<Sql, MultipleStatements<Sql>>
  : ParseNormalized<Normalize<Sql>>;
