import type { SplitColumnList, Trim, Unquote } from '../../string.js';
import type {
  ColumnProjectionIR,
  ExpressionProjectionIR,
  StarProjectionIR,
} from '../ir/projection.js';

type SplitAlias<Fragment extends string> =
  Fragment extends `${infer Expression} as ${infer Alias}` ? [Expression, Alias]
  : Fragment extends `${infer Expression} AS ${infer Alias}` ? [Expression, Alias]
  : Fragment extends `${infer Expression} As ${infer Alias}` ? [Expression, Alias]
  : Fragment extends `${infer Expression} aS ${infer Alias}` ? [Expression, Alias]
  : [Fragment, null];

type OutputName<Name extends string, Alias extends string | null> =
  Alias extends string ? Unquote<Trim<Alias>> : Unquote<Name>;

type ParseProjectionExpression<
  Expression extends string,
  Alias extends string | null,
> = Trim<Expression> extends infer Value extends string
  ? Value extends '*'
    ? StarProjectionIR
    : Value extends `${infer Qualifier}.*`
      ? StarProjectionIR<Unquote<Trim<Qualifier>>>
      : Value extends `${infer Qualifier}.${infer Name}`
        ? ColumnProjectionIR<
            Unquote<Trim<Qualifier>>,
            Unquote<Trim<Name>>,
            OutputName<Unquote<Trim<Name>>, Alias>
          >
        : Value extends `${string} ${string}` | `${string}(${string}` | `${string})${string}`
          ? ExpressionProjectionIR<Value, Alias extends string ? Unquote<Trim<Alias>> : Value>
          : ColumnProjectionIR<null, Unquote<Value>, OutputName<Unquote<Value>, Alias>>
  : never;

type ParseProjection<Fragment extends string> =
  SplitAlias<Trim<Fragment>> extends [
    infer Expression extends string,
    infer Alias extends string | null,
  ]
    ? ParseProjectionExpression<Expression, Alias>
    : never;

type ParseProjectionItems<
  Items extends readonly string[],
  Result extends unknown[] = [],
> = Items extends readonly [
  infer Head extends string,
  ...infer Tail extends string[],
]
  ? ParseProjectionItems<Tail, [...Result, ParseProjection<Head>]>
  : Result;

export type ParseProjectionList<Sql extends string> = ParseProjectionItems<SplitColumnList<Sql>>;
