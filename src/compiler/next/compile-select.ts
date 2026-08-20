import type { PredicateIR } from '../../language/ir/predicate.js';
import type { IsKeyword, Trim } from '../../string.js';
import type {
  SelectQueryIR,
  SetOperationIR,
} from '../../language/ir/query.js';
import type {
  DerivedSourceIR,
  JoinKind,
  SourceIR,
  TableSourceIR,
} from '../../language/ir/source.js';
import type { ParseSelectIR } from '../../language/select/parse-select.js';
import type {
  CompileFatal,
  CompileOk,
} from '../contracts/compilation.js';
import type { Diagnostic } from '../contracts/diagnostic.js';
import type { ResolveKey } from '../schema/model.js';
import type { InferProjections } from './infer-projection.js';
import type { InferExpression } from './infer-expression.js';
import type { ChildScope, Scope } from './scope.js';

type CompiledSources<
  Sources extends readonly SourceIR[],
  Diagnostics extends readonly Diagnostic[],
> = {
  sources: Sources;
  diagnostics: Diagnostics;
};

type UnknownTable<Name extends string> = Diagnostic<
  'UNKNOWN_TABLE',
  `unknown table: ${Name}`,
  'error',
  'from',
  Name
>;

type StripLeadingPunctuation<Value extends string> =
  Value extends `(${infer Rest}` ? StripLeadingPunctuation<Rest> : Value;

type StripTrailingPunctuation<Value extends string> =
  Value extends `${infer Rest})` | `${infer Rest},`
    ? StripTrailingPunctuation<Rest>
    : Value;

type StripPredicateCast<Token extends string> =
  Token extends `${infer Operand}::${string}` ? Operand : Token;

type CleanPredicateToken<Token extends string> =
  StripLeadingPunctuation<Token> extends infer Leading extends string
    ? StripPredicateCast<
        Leading extends `${string}(${string}`
          ? Leading
          : StripTrailingPunctuation<Leading>
      >
    : never;

type BeforeNestedSelect<
  Sql extends string,
  Before extends string = '',
> = Sql extends `${infer Head} ${infer Tail}`
  ? IsKeyword<CleanPredicateToken<Head>, 'select'> extends true
    ? Trim<Before>
    : BeforeNestedSelect<
        Tail,
        Before extends '' ? Head : `${Before} ${Head}`
      >
  : IsKeyword<CleanPredicateToken<Sql>, 'select'> extends true
    ? Trim<Before>
    : never;

type PredicateText<Sql extends string> = [BeforeNestedSelect<Sql>] extends [never]
  ? Sql
  : BeforeNestedSelect<Sql>;

type IgnoredPredicateWord =
  | ''
  | 'and'
  | 'or'
  | 'not'
  | 'is'
  | 'distinct'
  | 'from'
  | 'like'
  | 'ilike'
  | 'in'
  | 'between'
  | 'exists'
  | 'true'
  | 'false'
  | 'null'
  | 'asc'
  | 'desc';

type IsIgnoredPredicateToken<Token extends string> =
  Lowercase<Token> extends IgnoredPredicateWord
    ? true
    : Token extends
          | `${number}`
          | `'${string}'`
          | `$${string}`
          | `@${string}`
          | `:${string}`
          | '?'
          | '='
          | '<>'
          | '!='
          | '<'
          | '>'
          | '<='
          | '>='
          | '@>'
          | '<@'
      ? true
      : false;

type AnalyzePredicateTokens<
  DB,
  CurrentScope,
  Sql extends string,
  Diagnostics extends readonly Diagnostic[] = [],
> = Sql extends `${infer Head} ${infer Tail}`
  ? CleanPredicateToken<Head> extends infer Token extends string
    ? IsIgnoredPredicateToken<Token> extends true
      ? AnalyzePredicateTokens<DB, CurrentScope, Tail, Diagnostics>
      : InferExpression<DB, CurrentScope, Token> extends {
          diagnostics: infer TokenDiagnostics extends readonly Diagnostic[];
        }
        ? AnalyzePredicateTokens<
            DB,
            CurrentScope,
            Tail,
            [...Diagnostics, ...TokenDiagnostics]
          >
        : never
    : never
  : CleanPredicateToken<Sql> extends infer Token extends string
    ? IsIgnoredPredicateToken<Token> extends true
      ? Diagnostics
      : InferExpression<DB, CurrentScope, Token> extends {
          diagnostics: infer TokenDiagnostics extends readonly Diagnostic[];
        }
        ? [...Diagnostics, ...TokenDiagnostics]
        : never
    : never;

export type AnalyzePredicate<
  DB,
  CurrentScope,
  Predicate extends PredicateIR,
> = AnalyzePredicateTokens<DB, CurrentScope, PredicateText<Predicate['fragment']>>;

type AnalyzePredicates<
  DB,
  CurrentScope,
  Predicates extends readonly PredicateIR[],
  Diagnostics extends readonly Diagnostic[] = [],
> = Predicates extends readonly [
  infer Head extends PredicateIR,
  ...infer Tail extends PredicateIR[],
]
  ? Head['location'] extends 'having'
    ? AnalyzePredicates<DB, CurrentScope, Tail, Diagnostics>
    : AnalyzePredicate<DB, CurrentScope, Head> extends infer PredicateDiagnostics extends readonly Diagnostic[]
      ? AnalyzePredicates<
          DB,
          CurrentScope,
          Tail,
          [...Diagnostics, ...PredicateDiagnostics]
        >
      : never
  : Diagnostics;

type CompileSetOperations<
  DB,
  Operations extends readonly SetOperationIR[],
  ParentScope,
  ValidatePredicates extends boolean,
  Diagnostics extends readonly Diagnostic[] = [],
> = Operations extends readonly [
  infer Head extends SetOperationIR,
  ...infer Tail extends SetOperationIR[],
]
  ? Head['query'] extends infer Query extends SelectQueryIR
    ? CompileIR<DB, Query, ParentScope, ValidatePredicates> extends infer Compiled
      ? Compiled extends CompileOk<readonly unknown[], infer BranchDiagnostics>
        ? CompileSetOperations<
            DB,
            Tail,
            ParentScope,
            ValidatePredicates,
            [...Diagnostics, ...BranchDiagnostics]
          >
        : Compiled extends CompileFatal<unknown[], infer BranchDiagnostics>
          ? [...Diagnostics, ...BranchDiagnostics]
          : never
      : never
    : CompileSetOperations<DB, Tail, ParentScope, ValidatePredicates, Diagnostics>
  : Diagnostics;

type CompileSourceList<
  DB,
  Sources extends readonly SourceIR[],
  ParentScope,
  ValidatePredicates extends boolean,
  Result extends readonly SourceIR[] = [],
  Diagnostics extends readonly Diagnostic[] = [],
> = Sources extends readonly [
  infer Head extends SourceIR,
  ...infer Tail extends SourceIR[],
]
  ? Head extends DerivedSourceIR<
      infer Alias,
      infer Query extends SelectQueryIR,
      infer Nullable,
      infer Join extends JoinKind
    >
    ? CompileIR<DB, Query, ChildScope<Result, ParentScope>, ValidatePredicates> extends infer Nested
      ? Nested extends CompileOk<infer Rows extends readonly unknown[], infer NestedDiagnostics>
        ? CompileSourceList<
            DB,
            Tail,
            ParentScope,
            ValidatePredicates,
            [
              ...Result,
              DerivedSourceIR<Alias, Rows[number], Nullable, Join>,
            ],
            [...Diagnostics, ...NestedDiagnostics]
          >
        : Nested extends CompileFatal<unknown[], infer NestedDiagnostics>
          ? CompileFatal<unknown[], [...Diagnostics, ...NestedDiagnostics]>
          : never
      : never
    : Head extends TableSourceIR<
        infer Name,
        string,
        boolean,
        JoinKind,
        readonly string[]
      >
      ? CompileSourceList<
          DB,
          Tail,
          ParentScope,
          ValidatePredicates,
          [...Result, Head],
          ValidatePredicates extends true
            ? ResolveKey<DB, Name> extends never
              ? [...Diagnostics, UnknownTable<Name>]
              : Diagnostics
            : Diagnostics
        >
      : never
  : CompiledSources<Result, Diagnostics>;

type CompileIR<
  DB,
  IR extends SelectQueryIR,
  ParentScope = null,
  ValidatePredicates extends boolean = true,
> = CompileSourceList<DB, IR['sources'], ParentScope, ValidatePredicates> extends infer Compiled
    ? Compiled extends CompiledSources<
        infer ResolvedSources,
        infer SourceDiagnostics
      >
      ? InferProjections<
          DB,
          Scope<ResolvedSources, ParentScope>,
          IR['projections'],
          {},
          SourceDiagnostics
        > extends {
          row: infer Row;
          diagnostics: infer ProjectionDiagnostics extends readonly Diagnostic[];
        }
        ? (ValidatePredicates extends true
            ? AnalyzePredicates<
                DB,
                Scope<ResolvedSources, ParentScope>,
                IR['predicates']
              >
            : []) extends infer PredicateDiagnostics extends readonly Diagnostic[]
          ? CompileSetOperations<
              DB,
              IR['setOperations'],
              ParentScope,
              ValidatePredicates
            > extends infer SetDiagnostics extends readonly Diagnostic[]
            ? CompileOk<
                Row[],
                [
                  ...ProjectionDiagnostics,
                  ...PredicateDiagnostics,
                  ...SetDiagnostics,
                ]
              >
            : never
          : never
        : never
      : Compiled extends CompileFatal<unknown[], infer Diagnostics>
        ? CompileFatal<unknown[], Diagnostics>
        : never
    : never
  ;

export type CompileSelect<
  DB,
  Sql extends string,
  ParentScope = null,
  ValidatePredicates extends boolean = true,
> =
  ParseSelectIR<Sql> extends infer Parsed
    ? Parsed extends { kind: 'ok'; value: infer IR extends SelectQueryIR }
      ? CompileIR<DB, IR, ParentScope, ValidatePredicates>
      : Parsed extends CompileFatal<SelectQueryIR, infer Diagnostics>
        ? CompileFatal<unknown[], Diagnostics>
        : never
    : never;
