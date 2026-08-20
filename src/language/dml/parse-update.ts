import type {
  HasNonTrailingSemicolon,
  IsKeyword,
  Normalize,
  SplitAtTopLevelKeyword,
  SplitColumnList,
  StripQualifier,
  TakeUntilTopLevelKeyword,
  Trim,
  Unquote,
} from '../../string.js';
import type { PredicateIR } from '../ir/predicate.js';
import type { UpdateQueryIR } from '../ir/query.js';
import type { AssignmentIR, WriteTargetIR } from '../ir/write.js';
import type { ParseNormalizedFromSources } from '../select/parse-from.js';
import type {
  ParseWriteOutput,
  ParseWriteTarget,
} from './parse-insert.js';

type Assignment<Entry extends string> = Trim<Entry> extends `${infer Target}=${infer Value}`
  ? AssignmentIR<Unquote<StripQualifier<Trim<Target>>>, Trim<Value>>
  : AssignmentIR<Trim<Entry>, ''>;

type ParseAssignments<
  Entries extends readonly string[],
  Result extends AssignmentIR[] = [],
> = Entries extends readonly [
  infer Head extends string,
  ...infer Tail extends string[],
]
  ? ParseAssignments<Tail, [...Result, Assignment<Head>]>
  : Result;

export type ParseAssignmentList<Sql extends string> = ParseAssignments<
  SplitColumnList<Sql>
>;

type AssignmentText<Body extends string> = TakeUntilTopLevelKeyword<
  Body,
  'output' | 'from' | 'where' | 'returning'
>;

type ExtraSources<Body extends string> = [
  SplitAtTopLevelKeyword<Body, 'from'>,
] extends [never]
  ? { sources: []; predicates: [] }
  : SplitAtTopLevelKeyword<Body, 'from'> extends {
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

type MalformedUpdate<Sql extends string> = {
  code: 'MALFORMED_QUERY';
  message: 'malformed UPDATE query';
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

type ParseFatal<Sql extends string, Error = MalformedUpdate<Sql>> = {
  kind: 'fatal';
  readonly __value?: UpdateQueryIR;
  diagnostics: [Error];
};

type BuildUpdate<
  Sql extends string,
  TargetText extends string,
  Body extends string,
> = ParseWriteTarget<TargetText, 'set'> extends {
  target: infer Target extends WriteTargetIR;
}
  ? ExtraSources<Body> extends {
      sources: infer Sources extends readonly [] | readonly import('../ir/source.js').SourceIR[];
      predicates: infer JoinPredicates extends readonly PredicateIR[];
    }
    ? {
        kind: 'ok';
        value: UpdateQueryIR<
          Target,
          ParseAssignmentList<AssignmentText<Body>>,
          Sources,
          [...JoinPredicates, ...WherePredicate<Body>],
          ParseWriteOutput<Sql, 'where' | 'from'>
        >;
        diagnostics: [];
      }
    : ParseFatal<Sql>
  : ParseFatal<Sql>;

type ParseNormalized<Sql extends string> = Sql extends `${infer Update} ${infer Rest}`
  ? IsKeyword<Update, 'update'> extends true
    ? SplitAtTopLevelKeyword<Rest, 'set'> extends {
        before: infer Target extends string;
        after: infer Body extends string;
      }
      ? BuildUpdate<Sql, Target, Body>
      : ParseFatal<Sql>
    : ParseFatal<Sql>
  : ParseFatal<Sql>;

export type ParseUpdateIR<Sql extends string> = HasNonTrailingSemicolon<Sql> extends true
  ? ParseFatal<Sql, MultipleStatements<Sql>>
  : ParseNormalized<Normalize<Sql>>;
