import type {
  DropFirstWord,
  ExtractParenGroup,
  FirstWord,
  IsKeyword,
  Trim,
} from '../../string.js';

export interface DialectCapabilities {
  top: boolean;
  distinctOn: boolean;
  returning: boolean;
  output: boolean;
  placeholder: 'dollar' | 'question' | 'at' | 'mixed';
  quote: 'double' | 'backtick' | 'bracket' | 'mixed';
}

type StripTopCount<Sql extends string> = Trim<Sql> extends `(${infer Rest}`
  ? ExtractParenGroup<Rest> extends { rest: infer Tail extends string }
    ? Trim<Tail>
    : Trim<Sql>
  : DropFirstWord<Trim<Sql>>;

type StripWithTies<Sql extends string> = IsKeyword<FirstWord<Sql>, 'with'> extends true
  ? IsKeyword<FirstWord<DropFirstWord<Sql>>, 'ties'> extends true
    ? Trim<DropFirstWord<DropFirstWord<Sql>>>
    : Sql
  : Sql;

type HasTopCount<Sql extends string> = Trim<Sql> extends `(${string}`
  ? true
  : FirstWord<Trim<Sql>> extends `${number}`
    ? true
    : false;

type StripTop<Sql extends string> = IsKeyword<FirstWord<Trim<Sql>>, 'top'> extends true
  ? HasTopCount<DropFirstWord<Trim<Sql>>> extends true
    ? StripTopCount<DropFirstWord<Trim<Sql>>> extends infer Tail extends string
      ? IsKeyword<FirstWord<Tail>, 'percent'> extends true
        ? StripWithTies<Trim<DropFirstWord<Tail>>>
        : StripWithTies<Tail>
      : Sql
    : Sql
  : Sql;

type AfterDistinctOn<Sql extends string> = IsKeyword<FirstWord<Sql>, 'on'> extends true
  ? Trim<DropFirstWord<Sql>>
  : Trim<Sql> extends `${infer Head}(${infer Rest}`
    ? IsKeyword<Head, 'on'> extends true
      ? `(${Rest}`
      : never
    : never;

type StripDistinctOn<Sql extends string> = [AfterDistinctOn<Sql>] extends [never]
  ? Sql
  : AfterDistinctOn<Sql> extends `(${infer Rest}`
    ? ExtractParenGroup<Rest> extends { rest: infer Tail extends string }
      ? Trim<Tail>
      : Sql
    : Sql;

type StripDistinct<Sql extends string> = IsKeyword<FirstWord<Trim<Sql>>, 'distinct'> extends true
  ? StripDistinctOn<Trim<DropFirstWord<Trim<Sql>>>>
  : IsKeyword<FirstWord<Trim<Sql>>, 'all'> extends true
    ? Trim<DropFirstWord<Trim<Sql>>>
    : Sql;

export type StripSelectModifiers<Sql extends string> = Lowercase<FirstWord<Trim<Sql>>> extends
  | 'top'
  | 'distinct'
  | 'all'
  ? StripTop<StripDistinct<Sql>>
  : Sql;
