import type {
  Digit,
  Qualifier,
  StartsWithIdentifierChar,
  StripQualifier,
  Trim,
  Unquote,
} from '../../string.js';
import type { PredicateIR } from '../../language/ir/predicate.js';
import type {
  ProjectionIR,
  SelectQueryIR,
  SetOperationIR,
} from '../../language/ir/query.js';
import type { ExpressionProjectionIR } from '../../language/ir/projection.js';
import type { ParseSelectIR } from '../../language/select/parse-select.js';
import type { QueryTypeError } from '../contracts/public-error.js';
import type { InferExpression } from './infer-expression.js';
import type { ResolveColumn } from './resolve-column.js';
import type { RootScope } from './scope.js';

type Operator = '=' | '<>' | '!=' | '<' | '>' | '<=' | '>=' | '@>' | '<@';
type WordOperator = 'like' | 'ilike' | 'in' | 'between' | 'distinct';

type IsOperator<Token extends string> = Token extends Operator
  ? true
  : Lowercase<Token> extends WordOperator
    ? true
    : false;

type IsTransparent<Token extends string> = Token extends '(' | ')' | ','
  ? true
  : Lowercase<Token> extends 'and' | 'or' | 'not' | 'is' | 'from'
    ? true
    : false;

type StripLeadingParens<Value extends string> =
  Value extends `(${infer Rest}` ? StripLeadingParens<Rest> : Value;

type StripTrailingPunctuation<Value extends string> =
  Value extends `${infer Rest})` | `${infer Rest},`
    ? StripTrailingPunctuation<Rest>
    : Value;

type StripCast<Value extends string> =
  Value extends `${infer Before}::${string}` ? Before : Value;

type AfterLastOpenParen<Value extends string> =
  Value extends `${string}(${infer Rest}`
    ? Rest extends `${string}(${string}`
      ? AfterLastOpenParen<Rest>
      : Rest
    : Value;

type StripCallWrapper<Value extends string> =
  Value extends `${string}(${string}`
    ? AfterLastOpenParen<Value> extends infer Inner extends string
      ? Inner extends `${string},${string}`
        ? Value
        : Inner
      : Value
    : Value;

type CleanScanToken<Token extends string> = StripCast<
  StripCallWrapper<StripTrailingPunctuation<StripLeadingParens<Token>>>
>;

type CleanColumnToken<Token extends string> =
  StripLeadingParens<Token> extends infer Clean extends string
    ? Clean extends `${string}(${string}`
      ? Clean
      : StripTrailingPunctuation<Clean>
    : never;

type IsPlaceholder<Token extends string> =
  CleanScanToken<Token> extends `${string},${string}`
    ? false
    : CleanScanToken<Token> extends '?'
      ? true
      : Lowercase<CleanScanToken<Token>> extends '$action'
        ? false
        : CleanScanToken<Token> extends `$$${string}` | `@@${string}`
          ? false
          : CleanScanToken<Token> extends `$${infer Body}`
            ? StartsWithIdentifierChar<Body>
            : CleanScanToken<Token> extends `@${infer Body}` | `:${infer Body}`
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

type DigitsToCounter<
  Value extends string,
  Counter extends unknown[] = [],
> = Value extends `${infer Head}${infer Rest}`
  ? Head extends Digit
    ? DigitsToCounter<
        Rest,
        [...TimesTen<Counter>, ...DigitCounters[Head & keyof DigitCounters]]
      >
    : never
  : Counter;

type PlaceholderPosition<Token extends string> =
  CleanScanToken<Token> extends `$${infer Digits}`
    ? [DigitsToCounter<Digits>] extends [never]
      ? never
      : DigitsToCounter<Digits> extends [
          unknown,
          ...infer Position extends unknown[],
        ]
        ? Position
        : never
    : never;

type PlaceholderName<Token extends string> =
  CleanScanToken<Token> extends '?' ? never : CleanScanToken<Token>;

type FindNameIndex<
  Names extends readonly string[],
  Name extends string,
  Position extends unknown[] = [],
> = Names extends readonly [
  infer Head extends string,
  ...infer Tail extends string[],
]
  ? Head extends Name
    ? Position
    : FindNameIndex<Tail, Name, [...Position, unknown]>
  : never;

type MergeSlot<Current, Value, Label extends string> =
  Current extends QueryTypeError<string>
    ? Current
    : [Current & Value] extends [never]
      ? QueryTypeError<`conflicting types for ${Label}`>
      : Current & Value;

type SetSlot<
  Values extends readonly unknown[],
  Position extends readonly unknown[],
  Value,
  Label extends string,
> = Position extends readonly [unknown, ...infer PositionTail]
  ? Values extends readonly [infer Head, ...infer ValueTail]
    ? [Head, ...SetSlot<ValueTail, PositionTail, Value, Label>]
    : [unknown, ...SetSlot<[], PositionTail, Value, Label>]
  : Values extends readonly [infer Head, ...infer Tail]
    ? [MergeSlot<Head, Value, Label>, ...Tail]
    : [Value];

interface ParamState<
  Indexed extends readonly unknown[] = [],
  Sequential extends readonly unknown[] = [],
  Names extends readonly string[] = [],
> {
  indexed: Indexed;
  sequential: Sequential;
  names: Names;
}

type AnyParamState = ParamState<
  readonly unknown[],
  readonly unknown[],
  readonly string[]
>;

type EmptyParamState = ParamState<[], [], []>;

type AddParam<
  Token extends string,
  Value,
  State extends AnyParamState,
> = PlaceholderPosition<Token> extends infer Position
  ? [Position] extends [never]
    ? [PlaceholderName<Token>] extends [never]
      ? ParamState<
          State['indexed'],
          [...State['sequential'], Value],
          [...State['names'], '?']
        >
      : FindNameIndex<
            State['names'],
            PlaceholderName<Token>
          > extends infer Existing
        ? [Existing] extends [never]
          ? ParamState<
              State['indexed'],
              [...State['sequential'], Value],
              [...State['names'], PlaceholderName<Token>]
            >
          : Existing extends unknown[]
            ? ParamState<
                State['indexed'],
                SetSlot<
                  State['sequential'],
                  Existing,
                  Value,
                  CleanScanToken<Token>
                >,
                State['names']
              >
            : never
        : never
    : Position extends unknown[]
      ? ParamState<
          SetSlot<
            State['indexed'],
            Position,
            Value,
            CleanScanToken<Token>
          >,
          State['sequential'],
          State['names']
        >
      : never
  : never;

type ColumnType<
  DB,
  CurrentScope,
  Column extends string,
> = ResolveColumn<
  DB,
  CurrentScope,
  Qualifier<Column> extends '' ? null : Unquote<Qualifier<Column>>,
  Unquote<StripQualifier<Column>>
> extends { kind: 'ok'; value: infer Value }
  ? Value
  : unknown;

type FunctionName<Token extends string> =
  Token extends `${infer Name}(${string}` ? Lowercase<Name> : '';

type ContextValue<DB, CurrentScope, Expression extends string> =
  Expression extends `${string}(${string}`
    ? InferExpression<DB, CurrentScope, Expression> extends { value: infer Value }
      ? Value
      : unknown
    : ColumnType<DB, CurrentScope, Expression>;

type ParamValue<
  DB,
  CurrentScope,
  Column extends string,
  OperatorToken extends string,
  Token extends string,
> = Lowercase<OperatorToken> extends 'limit' | 'offset'
  ? number
  : IsOperator<OperatorToken> extends true
    ? FunctionName<Token> extends 'any' | 'all' | 'some'
      ? NonNullable<ColumnType<DB, CurrentScope, Column>>[]
      : Lowercase<OperatorToken> extends 'distinct'
        ? ContextValue<DB, CurrentScope, Column>
        : unknown extends ContextValue<DB, CurrentScope, Column>
          ? unknown
          : NonNullable<ContextValue<DB, CurrentScope, Column>>
    : unknown;

type ScanFragment<
  DB,
  CurrentScope,
  Sql extends string,
  State extends AnyParamState,
  PreviousPrevious extends string = '',
  Previous extends string = '',
> = Sql extends `${infer Head} ${infer Tail}`
  ? IsPlaceholder<Head> extends true
    ? AddParam<
        Head,
        ParamValue<
          DB,
          CurrentScope,
          PreviousPrevious,
          Previous,
          Head
        >,
        State
      > extends infer Next extends AnyParamState
      ? ScanFragment<
          DB,
          CurrentScope,
          Tail,
          Next,
          PreviousPrevious,
          Previous
        >
      : never
    : IsTransparent<Head> extends true
      ? ScanFragment<
          DB,
          CurrentScope,
          Tail,
          State,
          PreviousPrevious,
          Previous
        >
      : ScanFragment<
          DB,
          CurrentScope,
          Tail,
          State,
          Previous,
          CleanColumnToken<Head>
        >
  : Sql extends ''
    ? State
    : IsPlaceholder<Sql> extends true
      ? AddParam<
          Sql,
          ParamValue<
            DB,
            CurrentScope,
            PreviousPrevious,
            Previous,
            Sql
          >,
          State
        >
      : State;

type ScanPredicates<
  DB,
  CurrentScope,
  Predicates extends readonly PredicateIR[],
  State extends AnyParamState,
> = Predicates extends readonly [
  infer Head extends PredicateIR,
  ...infer Tail extends PredicateIR[],
]
  ? ScanFragment<
      DB,
      CurrentScope,
      Head['fragment'],
      State
    > extends infer Next extends AnyParamState
    ? ScanPredicates<DB, CurrentScope, Tail, Next>
    : never
  : State;

type ScanProjections<
  DB,
  CurrentScope,
  Projections extends readonly ProjectionIR[],
  State extends AnyParamState,
> = Projections extends readonly [
  infer Head extends ProjectionIR,
  ...infer Tail extends ProjectionIR[],
]
  ? Head extends ExpressionProjectionIR<infer Fragment, string>
    ? ScanFragment<
        DB,
        CurrentScope,
        Fragment,
        State
      > extends infer Next extends AnyParamState
      ? ScanProjections<DB, CurrentScope, Tail, Next>
      : never
    : ScanProjections<DB, CurrentScope, Tail, State>
  : State;

type ScanForcedNumber<
  DB,
  CurrentScope,
  Fragment extends string,
  Keyword extends 'limit' | 'offset',
  State extends AnyParamState,
> = Fragment extends ''
  ? State
  : ScanFragment<DB, CurrentScope, Fragment, State, '', Keyword>;

type InferSetParams<
  DB,
  Operations extends readonly SetOperationIR[],
  State extends AnyParamState,
> = Operations extends readonly [
  infer Head extends SetOperationIR,
  ...infer Tail extends SetOperationIR[],
]
  ? Head['query'] extends infer Query extends SelectQueryIR
    ? InferParamsFromIR<DB, Query, State> extends infer Next extends AnyParamState
      ? InferSetParams<DB, Tail, Next>
      : never
    : InferSetParams<DB, Tail, State>
  : State;

type InferParamsFromIR<
  DB,
  IR extends SelectQueryIR,
  State extends AnyParamState = EmptyParamState,
> = ScanProjections<
      DB,
      RootScope<IR['sources']>,
      IR['projections'],
      State
    > extends infer ProjectionState extends AnyParamState
    ? ScanPredicates<
        DB,
        RootScope<IR['sources']>,
        IR['predicates'],
        ProjectionState
      > extends infer PredicateState extends AnyParamState
      ? ScanForcedNumber<
          DB,
          RootScope<IR['sources']>,
          IR['clauses']['limit'],
          'limit',
          PredicateState
        > extends infer LimitState extends AnyParamState
        ? ScanForcedNumber<
            DB,
            RootScope<IR['sources']>,
            IR['clauses']['offset'],
            'offset',
            LimitState
          > extends infer OffsetState extends AnyParamState
          ? InferSetParams<DB, IR['setOperations'], OffsetState>
          : never
        : never
      : never
    : never;

export type InferNextParams<DB, Sql extends string> =
  ParseSelectIR<Sql> extends { kind: 'ok'; value: infer IR extends SelectQueryIR }
    ? InferParamsFromIR<DB, IR> extends infer State extends AnyParamState
      ? [...State['indexed'], ...State['sequential']]
      : unknown[]
    : unknown[];
