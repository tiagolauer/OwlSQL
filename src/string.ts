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

// Only the trailing semicolon is dropped. Scrubbing every semicolon in the
// string also destroyed the ones inside a quoted identifier (`"id;x"`), and a
// non-trailing one outside a quote is already rejected by
// HasNonTrailingSemicolon before anything reads this text (issue #232).
type RemoveTrailingSemicolons<S extends string> = TrimRight<S> extends `${infer Rest};`
  ? RemoveTrailingSemicolons<Rest>
  : S;

// A quote preceded by an odd run of backslashes is backslash-escaped (MySQL's
// default `\'` literal-quote escape) and isn't a delimiter - the run must be
// odd, not merely non-empty, since `\\'` is an escaped backslash followed by
// a real closing quote.
type EndsWithOddBackslashes<S extends string> = S extends `${infer Rest}\\`
  ? Rest extends `${infer Rest2}\\`
    ? EndsWithOddBackslashes<Rest2>
    : true
  : false;

type SkipLiteralBody<S extends string> = S extends `${infer Before}'${infer After}`
  ? EndsWithOddBackslashes<Before> extends true
    ? SkipLiteralBody<After>
    : After extends `'${infer Rest}`
      ? SkipLiteralBody<Rest>
      : { rest: After }
  : never;

type AfterLineComment<S extends string> = S extends `${string}
${infer Rest}`
  ? Rest
  : '';

type AfterBlockComment<S extends string> = S extends `${string}*/${infer Rest}` ? Rest : '';

export type Digit = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9';

type LowerAlpha =
  | 'a'
  | 'b'
  | 'c'
  | 'd'
  | 'e'
  | 'f'
  | 'g'
  | 'h'
  | 'i'
  | 'j'
  | 'k'
  | 'l'
  | 'm'
  | 'n'
  | 'o'
  | 'p'
  | 'q'
  | 'r'
  | 's'
  | 't'
  | 'u'
  | 'v'
  | 'w'
  | 'x'
  | 'y'
  | 'z';

type UpperAlpha = Uppercase<LowerAlpha>;

type IdentifierStart = LowerAlpha | UpperAlpha | '_';

type IdentifierChar = IdentifierStart | Digit;

type IsIdentifierTail<S extends string> = S extends ''
  ? true
  : S extends `${infer Head}${infer Rest}`
    ? Head extends IdentifierChar
      ? IsIdentifierTail<Rest>
      : false
    : false;

type IsDollarQuoteTag<S extends string> = S extends `${infer Head}${infer Rest}`
  ? Head extends IdentifierStart
    ? IsIdentifierTail<Rest>
    : false
  : false;

type DollarQuoteOpen<S extends string> = S extends `$${infer AfterOpen}`
  ? { tag: ''; afterOpen: AfterOpen }
  : S extends `${infer Tag}$${infer AfterOpen}`
    ? IsDollarQuoteTag<Tag> extends true
      ? { tag: Tag; afterOpen: AfterOpen }
      : never
    : never;

type SkipDollarQuotedBody<S extends string, Tag extends string> = Tag extends ''
  ? S extends `${string}$$${infer Rest}`
    ? { rest: Rest }
    : never
  : S extends `${string}$${Tag}$${infer Rest}`
    ? { rest: Rest }
    : never;

type HasMaskableToken<S extends string> = S extends
  | `${string}'${string}`
  | `${string}--${string}`
  | `${string}/*${string}`
  | `${string}$${string}`
  ? true
  : false;

export type StripCommentsAndMaskLiterals<
  S extends string,
  Accumulated extends string = '',
> = S extends ''
  ? Accumulated
  : HasMaskableToken<S> extends false
    ? `${Accumulated}${S}`
    : S extends `'${infer AfterQuote}`
      ? SkipLiteralBody<AfterQuote> extends { rest: infer Rest extends string }
        ? StripCommentsAndMaskLiterals<Rest, `${Accumulated}''`>
        : `${Accumulated}${S}`
      : S extends `--${infer AfterDash}`
        ? StripCommentsAndMaskLiterals<AfterLineComment<AfterDash>, `${Accumulated} `>
        : S extends `/*${infer AfterBlock}`
          ? StripCommentsAndMaskLiterals<AfterBlockComment<AfterBlock>, `${Accumulated} `>
          : S extends `$${infer AfterDollar}`
            ? [DollarQuoteOpen<AfterDollar>] extends [never]
              ? S extends `${infer Head}${infer Rest}`
                ? StripCommentsAndMaskLiterals<Rest, `${Accumulated}${Head}`>
                : Accumulated
              : DollarQuoteOpen<AfterDollar> extends {
                    tag: infer Tag extends string;
                    afterOpen: infer AfterOpen extends string;
                  }
                ? [SkipDollarQuotedBody<AfterOpen, Tag>] extends [never]
                  ? `${Accumulated}${S}`
                  : SkipDollarQuotedBody<AfterOpen, Tag> extends { rest: infer Rest extends string }
                    ? StripCommentsAndMaskLiterals<Rest, `${Accumulated}''`>
                    : Accumulated
                : Accumulated
            : S extends `${infer Head}${infer Rest}`
              ? StripCommentsAndMaskLiterals<Rest, `${Accumulated}${Head}`>
              : Accumulated;

export type Normalize<S extends string> = Trim<
  CollapseSpaces<WhitespaceToSpace<RemoveTrailingSemicolons<StripCommentsAndMaskLiterals<S>>>>
>;

type HasQuoteChar<S extends string> = S extends
  | `${string}"${string}`
  | `${string}\`${string}`
  | `${string}[${string}`
  ? true
  : false;

type AfterIdentifierClose<S extends string, Close extends string> =
  S extends `${string}${Close}${infer Rest}` ? Rest : '';

// Quoted identifiers are the one piece of a query StripCommentsAndMaskLiterals
// deliberately leaves intact - the parser needs the name. That makes their
// bodies the last place raw punctuation survives, so anything scanning the
// masked text for structure has to blank them first (issue #232).
type MaskQuotedIdentifiers<S extends string, Accumulated extends string = ''> =
  HasQuoteChar<S> extends false
    ? `${Accumulated}${S}`
    : S extends `"${infer AfterOpen}`
      ? MaskQuotedIdentifiers<AfterIdentifierClose<AfterOpen, '"'>, `${Accumulated}""`>
      : S extends `\`${infer AfterOpen}`
        ? MaskQuotedIdentifiers<AfterIdentifierClose<AfterOpen, '\`'>, `${Accumulated}\`\``>
        : S extends `[${infer AfterOpen}`
          ? MaskQuotedIdentifiers<AfterIdentifierClose<AfterOpen, ']'>, `${Accumulated}[]`>
          : S extends `${infer Head}${infer Rest}`
            ? MaskQuotedIdentifiers<Rest, `${Accumulated}${Head}`>
            : Accumulated;

// RemoveSemicolons strips every semicolon, not just a single trailing one, so
// a second statement after a non-trailing semicolon would otherwise be
// silently merged into the first. Checked against the comment-stripped,
// literal-masked text (so a semicolon inside a comment or a string literal is
// never mistaken for a separator) with quoted identifiers blanked on top of
// it, since a column may legally be named `"a;b"`.
export type HasNonTrailingSemicolon<S extends string> =
  Trim<MaskQuotedIdentifiers<StripCommentsAndMaskLiterals<S>>> extends `${string};${infer After}`
    ? Trim<After> extends ''
      ? false
      : true
    : false;

export type Unquote<S extends string> = S extends `"${infer Inner}"`
  ? Inner
  : S extends `[${infer Inner}]`
    ? Inner
    : S extends `\`${infer Inner}\``
      ? Inner
      : S;

export type FirstWord<S extends string> = S extends `${infer Head} ${string}`
  ? Head
  : S;

// `insert into users(id, name)` is as legal as `insert into users (id, name)`,
// and the target is a space-delimited word either way - so the name has to be
// cut at the paren too, or the table is read as `users(id,` (issue #245).
export type BeforeParen<S extends string> = S extends `${infer Before}(${string}` ? Before : S;

export type StripQualifier<S extends string> = S extends `${string}.${infer Rest}`
  ? StripQualifier<Rest>
  : S;

export type Qualifier<S extends string> = S extends `${infer Head}.${string}` ? Head : '';

export type DropFirstWord<S extends string> = S extends `${string} ${infer Rest}`
  ? Rest
  : '';

export type IsKeyword<Token extends string, Keyword extends string> =
  Lowercase<Token> extends Lowercase<Keyword> ? true : false;

type SplitAtNextParen<S extends string> = S extends `${infer BeforeOpen}(${infer AfterOpen}`
  ? BeforeOpen extends `${infer BeforeClose})${infer AfterClose}`
    ? { before: BeforeClose; marker: ')'; after: `${AfterClose}(${AfterOpen}` }
    : { before: BeforeOpen; marker: '('; after: AfterOpen }
  : S extends `${infer BeforeClose})${infer AfterClose}`
    ? { before: BeforeClose; marker: ')'; after: AfterClose }
    : never;

type ScanParenGroup<
  S extends string,
  Depth extends unknown[],
  Inner extends string,
> = [SplitAtNextParen<S>] extends [never]
  ? { inner: `${Inner}${S}`; rest: '' }
  : SplitAtNextParen<S> extends {
        before: infer Before extends string;
        marker: infer Marker extends string;
        after: infer After extends string;
      }
    ? Marker extends '('
      ? ScanParenGroup<After, [...Depth, unknown], `${Inner}${Before}(`>
      : Depth extends [unknown, ...infer DepthRest extends unknown[]]
        ? ScanParenGroup<After, DepthRest, `${Inner}${Before})`>
        : { inner: `${Inner}${Before}`; rest: After }
    : never;

export type ExtractParenGroup<S extends string> = ScanParenGroup<S, [], ''>;

type SplitAtNextListMarker<S extends string> = S extends `${infer BeforeComma},${infer AfterComma}`
  ? BeforeComma extends `${infer BeforeOpen}(${infer AfterOpen}`
    ? BeforeOpen extends `${infer BeforeClose})${infer AfterClose}`
      ? { before: BeforeClose; marker: ')'; after: `${AfterClose}(${AfterOpen},${AfterComma}` }
      : { before: BeforeOpen; marker: '('; after: `${AfterOpen},${AfterComma}` }
    : BeforeComma extends `${infer BeforeClose})${infer AfterClose}`
      ? { before: BeforeClose; marker: ')'; after: `${AfterClose},${AfterComma}` }
      : { before: BeforeComma; marker: ','; after: AfterComma }
  : SplitAtNextParen<S>;

type ScanColumnList<
  S extends string,
  Depth extends unknown[],
  Current extends string,
  Accumulated extends string[],
> = [SplitAtNextListMarker<S>] extends [never]
  ? [...Accumulated, Trim<`${Current}${S}`>]
  : SplitAtNextListMarker<S> extends {
        before: infer Before extends string;
        marker: infer Marker extends string;
        after: infer After extends string;
      }
    ? Marker extends '('
      ? ScanColumnList<After, [...Depth, unknown], `${Current}${Before}(`, Accumulated>
      : Marker extends ')'
        ? Depth extends [unknown, ...infer DepthRest extends unknown[]]
          ? ScanColumnList<After, DepthRest, `${Current}${Before})`, Accumulated>
          : ScanColumnList<After, Depth, `${Current}${Before})`, Accumulated>
        : Depth extends []
          ? ScanColumnList<After, Depth, '', [...Accumulated, Trim<`${Current}${Before}`>]>
          : ScanColumnList<After, Depth, `${Current}${Before},`, Accumulated>
    : never;

export type SplitColumnList<S extends string> = ScanColumnList<S, [], '', []>;

export type OpenCount<
  S extends string,
  Accumulated extends unknown[] = [],
> = S extends `${string}(${infer After}`
  ? OpenCount<After, [...Accumulated, unknown]>
  : Accumulated;

export type CloseCount<
  S extends string,
  Accumulated extends unknown[] = [],
> = S extends `${string})${infer After}`
  ? CloseCount<After, [...Accumulated, unknown]>
  : Accumulated;

type PopN<Depth extends unknown[], N extends unknown[]> = N extends [unknown, ...infer NRest]
  ? Depth extends [unknown, ...infer DepthRest]
    ? PopN<DepthRest, NRest>
    : Depth
  : Depth;

export type ApplyParenDelta<Depth extends unknown[], Token extends string> = PopN<
  [...Depth, ...OpenCount<Token>],
  CloseCount<Token>
>;
