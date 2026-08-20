import type {
  DropFirstWord,
  ExtractParenGroup,
  FirstWord,
  IsKeyword,
  Qualifier,
  SplitColumnList,
  StripQualifier,
  Trim,
  Unquote,
} from '../../string.js';
import type {
  FunctionReturnType,
  IsFunctionCall,
} from '../semantics/functions.js';
import type { Diagnostic } from '../contracts/diagnostic.js';
import type { ResolveColumn } from './resolve-column.js';

export type ExpressionResult<
  Value,
  Diagnostics extends readonly Diagnostic[] = [],
> = {
  kind: 'ok';
  value: Value;
  diagnostics: Diagnostics;
};

type LiteralType<Expression extends string> = Trim<Expression> extends `'${string}'`
  ? string
  : Trim<Expression> extends `${number}`
    ? number
    : Lowercase<Trim<Expression>> extends 'true' | 'false'
      ? boolean
      : Lowercase<Trim<Expression>> extends 'null'
        ? null
        : never;

type Operator = '*' | '+' | '-' | '/' | '%' | '|' | '<' | '>' | '=' | '^';

type IsOperatorExpression<Expression extends string> =
  Expression extends `${string}"${string}` | `${string}[${string}` | `${string}\`${string}`
    ? false
    : Expression extends `${string}${Operator}${string}`
      ? true
      : false;

type StripDistinct<Argument extends string> =
  IsKeyword<FirstWord<Trim<Argument>>, 'distinct'> extends true
    ? Trim<DropFirstWord<Trim<Argument>>>
    : Trim<Argument>;

type FunctionArguments<Expression extends string> =
  Expression extends `${string}(${infer AfterOpen}`
    ? ExtractParenGroup<AfterOpen> extends { inner: infer Inner extends string }
      ? SplitColumnList<Inner>
      : []
    : [];

type InferArguments<
  DB,
  CurrentScope,
  Arguments extends readonly string[],
  Diagnostics extends readonly Diagnostic[] = [],
> = Arguments extends readonly [
  infer Head extends string,
  ...infer Tail extends string[],
]
  ? StripDistinct<Head> extends infer Argument extends string
    ? Argument extends '' | '*' | `$${string}` | `@${string}` | '?'
      ? InferArguments<DB, CurrentScope, Tail, Diagnostics>
      : InferExpression<DB, CurrentScope, Argument> extends ExpressionResult<
          unknown,
          infer ArgumentDiagnostics
        >
        ? InferArguments<
            DB,
            CurrentScope,
            Tail,
            [...Diagnostics, ...ArgumentDiagnostics]
          >
        : never
    : never
  : Diagnostics;

type StripLeadingParens<Value extends string> =
  Value extends `(${infer Rest}` ? StripLeadingParens<Rest> : Value;

type StripTrailingParens<Value extends string> =
  Value extends `${infer Rest})` ? StripTrailingParens<Rest> : Value;

type IsCaseToken<Token extends string> = IsKeyword<StripLeadingParens<Token>, 'case'>;
type IsEndToken<Token extends string> = IsKeyword<StripTrailingParens<Token>, 'end'>;

interface CaseSegment {
  kind: 'when' | 'then' | 'else';
  text: string;
}

type ScanCase<
  Sql extends string,
  CurrentKind extends CaseSegment['kind'],
  CurrentText extends string,
  Segments extends readonly CaseSegment[],
  Depth extends unknown[] = [],
> = Sql extends `${infer Head} ${infer Tail}`
  ? IsCaseToken<Head> extends true
    ? ScanCase<
        Tail,
        CurrentKind,
        CurrentText extends '' ? Head : `${CurrentText} ${Head}`,
        Segments,
        [...Depth, unknown]
      >
    : IsEndToken<Head> extends true
      ? Depth extends [unknown, ...infer Rest extends unknown[]]
        ? ScanCase<
            Tail,
            CurrentKind,
            CurrentText extends '' ? Head : `${CurrentText} ${Head}`,
            Segments,
            Rest
          >
        : ScanCase<Tail, CurrentKind, CurrentText, Segments, Depth>
      : Depth extends []
        ? IsKeyword<Head, 'when'> extends true
          ? ScanCase<
              Tail,
              'when',
              '',
              [...Segments, { kind: CurrentKind; text: Trim<CurrentText> }]
            >
          : IsKeyword<Head, 'then'> extends true
            ? ScanCase<
                Tail,
                'then',
                '',
                [...Segments, { kind: CurrentKind; text: Trim<CurrentText> }]
              >
            : IsKeyword<Head, 'else'> extends true
              ? ScanCase<
                  Tail,
                  'else',
                  '',
                  [...Segments, { kind: CurrentKind; text: Trim<CurrentText> }]
                >
              : ScanCase<
                  Tail,
                  CurrentKind,
                  CurrentText extends '' ? Head : `${CurrentText} ${Head}`,
                  Segments,
                  Depth
                >
        : ScanCase<
            Tail,
            CurrentKind,
            CurrentText extends '' ? Head : `${CurrentText} ${Head}`,
            Segments,
            Depth
          >
  : [
      ...Segments,
      {
        kind: CurrentKind;
        text: Trim<CurrentText extends '' ? Sql : `${CurrentText} ${Sql}`>;
      },
    ];

type HasElse<Segments extends readonly CaseSegment[]> =
  Segments extends readonly [
    infer Head extends CaseSegment,
    ...infer Tail extends CaseSegment[],
  ]
    ? Head['kind'] extends 'else'
      ? true
      : HasElse<Tail>
    : false;

type InferCaseBranches<
  DB,
  CurrentScope,
  Segments extends readonly CaseSegment[],
  Values = never,
  Diagnostics extends readonly Diagnostic[] = [],
> = Segments extends readonly [
  infer Head extends CaseSegment,
  ...infer Tail extends CaseSegment[],
]
  ? Head['kind'] extends 'then' | 'else'
    ? InferExpression<DB, CurrentScope, Head['text']> extends ExpressionResult<
        infer Value,
        infer BranchDiagnostics
      >
      ? InferCaseBranches<
          DB,
          CurrentScope,
          Tail,
          Values | Value,
          [...Diagnostics, ...BranchDiagnostics]
        >
      : never
    : InferCaseBranches<DB, CurrentScope, Tail, Values, Diagnostics>
  : ExpressionResult<Values, Diagnostics>;

type SplitLastWord<
  Sql extends string,
  Before extends string = '',
> = Sql extends `${infer Head} ${infer Tail}`
  ? SplitLastWord<Tail, Before extends '' ? Head : `${Before} ${Head}`>
  : { before: Before; last: Sql };

type InferCase<
  DB,
  CurrentScope,
  Expression extends string,
> = SplitLastWord<DropFirstWord<Trim<Expression>>> extends {
  before: infer Body extends string;
  last: infer End extends string;
}
  ? IsKeyword<End, 'end'> extends true
    ? ScanCase<Body, 'when', '', []> extends infer Segments extends readonly CaseSegment[]
      ? InferCaseBranches<DB, CurrentScope, Segments> extends ExpressionResult<
          infer Value,
          infer Diagnostics
        >
        ? ExpressionResult<HasElse<Segments> extends true ? Value : Value | null, Diagnostics>
        : never
      : never
    : ExpressionResult<unknown>
  : ExpressionResult<unknown>;

type InferReference<
  DB,
  CurrentScope,
  Expression extends string,
> = ResolveColumn<
  DB,
  CurrentScope,
  Qualifier<Expression> extends '' ? null : Unquote<Qualifier<Expression>>,
  Unquote<StripQualifier<Expression>>
> extends infer Resolution
  ? Resolution extends { kind: 'ok'; value: infer Value }
    ? ExpressionResult<Value>
    : Resolution extends {
        kind: 'error';
        diagnostic: infer Error extends Diagnostic;
      }
      ? ExpressionResult<unknown, [Error]>
      : never
  : never;

type InferFunction<
  DB,
  CurrentScope,
  Expression extends string,
> = InferArguments<
  DB,
  CurrentScope,
  FunctionArguments<Expression>
> extends infer Diagnostics extends readonly Diagnostic[]
  ? ExpressionResult<FunctionReturnType<Expression>, Diagnostics>
  : never;

export type InferExpression<
  DB,
  CurrentScope,
  Expression extends string,
> = Trim<Expression> extends infer Value extends string
  ? IsCaseToken<FirstWord<Value>> extends true
    ? InferCase<DB, CurrentScope, Value>
    : Value extends `${infer Operand}::${string}`
      ? InferReference<DB, CurrentScope, Trim<Operand>> extends ExpressionResult<
          unknown,
          infer Diagnostics
        >
        ? ExpressionResult<unknown, Diagnostics>
        : never
      : IsFunctionCall<Value> extends true
        ? InferFunction<DB, CurrentScope, Value>
        : [LiteralType<Value>] extends [never]
          ? IsOperatorExpression<Value> extends true
            ? ExpressionResult<unknown>
            : InferReference<DB, CurrentScope, Value>
          : ExpressionResult<LiteralType<Value>>
  : never;
