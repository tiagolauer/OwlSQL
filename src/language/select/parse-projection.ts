import type {
  ApplyParenDelta,
  DropFirstWord,
  ExtractParenGroup,
  FirstWord,
  IsKeyword,
  SplitColumnList,
  StripQualifier,
  Trim,
  Unquote,
} from '../../string.js';
import type {
  ColumnProjectionIR,
  ExpressionProjectionIR,
  StarProjectionIR,
} from '../ir/projection.js';

type FunctionName<Expression extends string> =
  Expression extends `${infer Name}(${string}` ? Trim<Name> : Expression;

type IsFunctionCall<Expression extends string> =
  Expression extends `${string}(${string})`
    ? FunctionName<Expression> extends ''
      ? false
      : true
    : false;

type OutputName<Expression extends string> =
  IsFunctionCall<Expression> extends true
    ? FunctionName<Expression>
    : Unquote<StripQualifier<Expression>>;

type StripLeadingParens<Value extends string> =
  Value extends `(${infer Rest}` ? StripLeadingParens<Rest> : Value;

type StripTrailingParens<Value extends string> =
  Value extends `${infer Rest})` ? StripTrailingParens<Rest> : Value;

type IsCaseToken<Token extends string> = IsKeyword<StripLeadingParens<Token>, 'case'>;
type IsEndToken<Token extends string> = IsKeyword<StripTrailingParens<Token>, 'end'>;

type FindCaseEnd<
  Sql extends string,
  Depth extends unknown[] = [],
  Body extends string = '',
> = Sql extends `${infer Head} ${infer Tail}`
  ? IsCaseToken<Head> extends true
    ? FindCaseEnd<Tail, [...Depth, unknown], Body extends '' ? Head : `${Body} ${Head}`>
    : IsEndToken<Head> extends true
      ? Depth extends [unknown, ...infer Rest extends unknown[]]
        ? FindCaseEnd<Tail, Rest, Body extends '' ? Head : `${Body} ${Head}`>
        : { body: Trim<Body>; rest: Trim<Tail> }
      : FindCaseEnd<Tail, Depth, Body extends '' ? Head : `${Body} ${Head}`>
  : IsEndToken<Sql> extends true
    ? Depth extends []
      ? { body: Trim<Body>; rest: '' }
      : never
    : never;

type SplitCase<Entry extends string> =
  DropFirstWord<Trim<Entry>> extends infer AfterCase extends string
    ? FindCaseEnd<AfterCase> extends {
        body: infer Body extends string;
        rest: infer Rest extends string;
      }
      ? Rest extends ''
        ? [`case ${Body} end`, 'case']
        : IsKeyword<FirstWord<Rest>, 'as'> extends true
          ? [`case ${Body} end`, Unquote<Trim<DropFirstWord<Rest>>>]
          : [`case ${Body} end`, Unquote<Trim<Rest>>]
      : [Trim<Entry>, OutputName<Trim<Entry>>]
    : [Trim<Entry>, OutputName<Trim<Entry>>];

type OverAttachedParen<Token extends string> =
  Token extends `${infer Word}(${infer Rest}`
    ? IsKeyword<Word, 'over'> extends true
      ? Rest
      : never
    : never;

type FindOver<
  Sql extends string,
  Before extends string = '',
> = Sql extends `${infer Head} ${infer Tail}`
  ? IsKeyword<Head, 'over'> extends true
    ? IsFunctionCall<Trim<Before>> extends true
      ? { expression: Trim<Before>; rest: Tail }
      : FindOver<Tail, Before extends '' ? Head : `${Before} ${Head}`>
    : OverAttachedParen<Head> extends infer Rest extends string
      ? [Rest] extends [never]
        ? FindOver<Tail, Before extends '' ? Head : `${Before} ${Head}`>
        : IsFunctionCall<Trim<Before>> extends true
          ? { expression: Trim<Before>; rest: `(${Rest} ${Tail}` }
          : FindOver<Tail, Before extends '' ? Head : `${Before} ${Head}`>
      : never
  : OverAttachedParen<Sql> extends infer Rest extends string
    ? [Rest] extends [never]
      ? never
      : IsFunctionCall<Trim<Before>> extends true
        ? { expression: Trim<Before>; rest: `(${Rest}` }
        : never
    : never;

type SplitWindow<Entry extends string> = [FindOver<Entry>] extends [never]
  ? never
  : FindOver<Entry> extends {
      expression: infer Expression extends string;
      rest: infer Rest extends string;
    }
    ? Trim<Rest> extends `(${infer AfterOpen}`
      ? ExtractParenGroup<AfterOpen> extends { rest: infer After extends string }
        ? [Expression, Trim<After>]
        : never
      : Trim<Rest> extends ''
        ? never
        : [Expression, Trim<DropFirstWord<Trim<Rest>>>]
    : never;

type SplitParenthesized<Entry extends string> =
  Trim<Entry> extends `(${infer AfterOpen}`
    ? ExtractParenGroup<AfterOpen> extends {
        inner: infer Inner extends string;
        rest: infer After extends string;
      }
      ? [`(${Inner})`, Trim<After>]
      : never
    : never;

type FindTopLevelAs<
  Sql extends string,
  Depth extends unknown[] = [],
  Before extends string = '',
> = Sql extends `${infer Head} ${infer Tail}`
  ? Depth extends []
    ? IsKeyword<Head, 'as'> extends true
      ? { expression: Trim<Before>; alias: Tail }
      : FindTopLevelAs<
          Tail,
          ApplyParenDelta<Depth, Head>,
          Before extends '' ? Head : `${Before} ${Head}`
        >
    : FindTopLevelAs<
        Tail,
        ApplyParenDelta<Depth, Head>,
        Before extends '' ? Head : `${Before} ${Head}`
      >
  : never;

type SplitTopLevelSpace<
  Sql extends string,
  Depth extends unknown[] = [],
  Before extends string = '',
> = Sql extends `${infer Head} ${infer Tail}`
  ? ApplyParenDelta<Depth, Head> extends infer NextDepth extends unknown[]
    ? NextDepth extends []
      ? { expression: Before extends '' ? Head : `${Before} ${Head}`; alias: Tail }
      : SplitTopLevelSpace<
          Tail,
          NextDepth,
          Before extends '' ? Head : `${Before} ${Head}`
        >
    : never
  : never;

type Operator = '*' | '+' | '-' | '/' | '%' | '|' | '<' | '>' | '=' | '^';

type IsOperatorExpression<Sql extends string> =
  Sql extends `${string}"${string}` | `${string}[${string}` | `${string}\`${string}`
    ? false
    : Sql extends `${string}${Operator}${string}`
      ? true
      : false;

type UnwrapParens<Expression extends string> = Expression extends `(${infer Inner})`
  ? Inner extends `${string})${string}`
    ? Expression
    : IsKeyword<FirstWord<Trim<Inner>>, 'select'> extends true
      ? Expression
      : Trim<Inner>
  : Expression;

type ParseComplexEntry<Entry extends string> =
  IsCaseToken<FirstWord<Trim<Entry>>> extends true
    ? SplitCase<Entry>
    : [SplitWindow<Entry>] extends [never]
      ? [SplitParenthesized<Entry>] extends [never]
        ? [FindTopLevelAs<Entry>] extends [never]
          ? [SplitTopLevelSpace<Entry>] extends [never]
            ? [Trim<Entry>, OutputName<Trim<Entry>>]
            : SplitTopLevelSpace<Entry> extends {
                expression: infer Expression extends string;
                alias: infer Alias extends string;
              }
              ? IsOperatorExpression<Alias> extends true
                ? [Trim<Entry>, OutputName<Trim<Entry>>]
                : [Trim<Expression>, Unquote<Trim<Alias>>]
              : [Trim<Entry>, OutputName<Trim<Entry>>]
          : FindTopLevelAs<Entry> extends {
              expression: infer Expression extends string;
              alias: infer Alias extends string;
            }
            ? [Expression, Unquote<Trim<Alias>>]
            : [Trim<Entry>, OutputName<Trim<Entry>>]
        : SplitParenthesized<Entry> extends [
            infer Expression extends string,
            infer After extends string,
          ]
          ? After extends ''
            ? [UnwrapParens<Expression>, Trim<Entry>]
            : IsKeyword<FirstWord<After>, 'as'> extends true
              ? [UnwrapParens<Expression>, Unquote<Trim<DropFirstWord<After>>>]
              : IsOperatorExpression<After> extends true
                ? [FindTopLevelAs<Entry>] extends [never]
                  ? [Trim<Entry>, Trim<Entry>]
                  : FindTopLevelAs<Entry> extends {
                      expression: infer FullExpression extends string;
                      alias: infer Alias extends string;
                    }
                    ? [FullExpression, Unquote<Trim<Alias>>]
                    : [Trim<Entry>, Trim<Entry>]
                : [UnwrapParens<Expression>, Unquote<Trim<After>>]
          : [Trim<Entry>, OutputName<Trim<Entry>>]
      : SplitWindow<Entry> extends [
          infer Expression extends string,
          infer After extends string,
        ]
        ? After extends ''
          ? [Expression, OutputName<Expression>]
          : IsKeyword<FirstWord<After>, 'as'> extends true
            ? [Expression, Unquote<Trim<DropFirstWord<After>>>]
            : [Expression, Unquote<Trim<After>>]
        : [Trim<Entry>, OutputName<Trim<Entry>>];

type ParseEntry<Entry extends string> = Trim<Entry> extends infer Value extends string
  ? Value extends `${string} ${string}` | `(${string}`
    ? ParseComplexEntry<Value>
    : [Value, OutputName<Value>]
  : never;

type IsColumn<Expression extends string> =
  Expression extends `${string} ${string}`
    ? false
    : Expression extends `${string}(${string}` | `${string})${string}`
      ? false
      : Expression extends `${string}::${string}`
        ? false
        : IsOperatorExpression<Expression> extends true
          ? false
          : Expression extends `${number}` | `'${string}'`
            ? false
            : Lowercase<Expression> extends 'true' | 'false' | 'null'
              ? false
              : true;

type ToProjection<Entry extends string> = ParseEntry<Entry> extends [
  infer Expression extends string,
  infer Name extends string,
]
  ? Expression extends '*'
    ? StarProjectionIR
    : Expression extends `${infer Qualifier}.*`
      ? StarProjectionIR<Unquote<Trim<Qualifier>>>
      : IsColumn<Expression> extends true
        ? Expression extends `${infer Qualifier}.${infer Column}`
          ? ColumnProjectionIR<
              Unquote<Trim<Qualifier>>,
              Unquote<Trim<Column>>,
              Name
            >
          : ColumnProjectionIR<null, Unquote<Trim<Expression>>, Name>
        : ExpressionProjectionIR<Expression, Name>
  : never;

type ParseItems<
  Items extends readonly string[],
  Result extends unknown[] = [],
> = Items extends readonly [
  infer Head extends string,
  ...infer Tail extends string[],
]
  ? ParseItems<Tail, [...Result, ToProjection<Head>]>
  : Result;

export type ParseProjectionList<Sql extends string> = ParseItems<SplitColumnList<Sql>>;
