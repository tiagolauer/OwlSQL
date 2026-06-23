export type NonSpaceWhitespace = '\t' | '\n' | '\r' | '\f' | '\v';

export type Whitespace = ' ' | NonSpaceWhitespace;

export type TrimLeft<S extends string> = S extends `${Whitespace}${infer Rest}`
  ? TrimLeft<Rest>
  : S;

export type TrimRight<S extends string> = S extends `${infer Rest}${Whitespace}`
  ? TrimRight<Rest>
  : S;

export type Trim<S extends string> = TrimLeft<TrimRight<S>>;

type WhitespaceToSpace<S extends string> =
  S extends `${infer Before}${NonSpaceWhitespace}${infer After}`
    ? WhitespaceToSpace<`${Before} ${After}`>
    : S;

type CollapseSpaces<S extends string> = S extends `${infer Before}  ${infer After}`
  ? CollapseSpaces<`${Before} ${After}`>
  : S;

export type Normalize<S extends string> = Trim<
  CollapseSpaces<WhitespaceToSpace<S>>
>;

export type FirstWord<S extends string> = S extends `${infer Head} ${string}`
  ? Head
  : S;

export type StripQualifier<S extends string> = S extends `${string}.${infer Rest}`
  ? StripQualifier<Rest>
  : S;

export type IsKeyword<Token extends string, Keyword extends string> =
  Lowercase<Token> extends Lowercase<Keyword> ? true : false;
