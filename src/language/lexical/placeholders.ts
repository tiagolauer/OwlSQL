import type {
  MaskQuotedIdentifiers,
  Normalize,
  StartsWithIdentifierChar,
} from './string.js';

type StripDoubledAt<S extends string> = S extends `${infer Before}@@${infer After}`
  ? StripDoubledAt<`${Before}${After}`>
  : S;

type StripDollarAction<S extends string> = S extends `${infer Before}$action${infer After}`
  ? StartsWithIdentifierChar<After> extends true
    ? `${Before}$action${StripDollarAction<After>}`
    : `${Before}${StripDollarAction<After>}`
  : S;

type HasPrefixedPlaceholder<
  S extends string,
  Prefix extends string,
> = S extends `${string}${Prefix}${infer After}`
  ? StartsWithIdentifierChar<After> extends true
    ? true
    : HasPrefixedPlaceholder<After, Prefix>
  : false;

type HasQuestionPlaceholder<S extends string> = S extends `${string}?${infer After}`
  ? After extends `|${string}` | `&${string}`
    ? HasQuestionPlaceholder<After>
    : true
  : false;

export type UsedPlaceholderStyles<Q extends string> = Lowercase<
  MaskQuotedIdentifiers<Normalize<Q>>
> extends infer Text extends string
  ?
      | (HasQuestionPlaceholder<Text> extends true ? 'question' : never)
      | (HasPrefixedPlaceholder<StripDollarAction<Text>, '$'> extends true ? 'dollar' : never)
      | (HasPrefixedPlaceholder<StripDoubledAt<Text>, '@'> extends true ? 'at' : never)
  : never;
