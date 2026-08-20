import type {
  ApplyParenDelta,
  IsKeyword,
  Normalize,
  Trim,
} from '../../string.js';
import type { SelectQueryIR } from '../ir/query.js';
import type { TableSourceIR } from '../ir/source.js';
import type { ParseRootSource } from './parse-from.js';
import type { ParseProjectionList } from './parse-projection.js';

type SplitAtFrom<
  Sql extends string,
  Depth extends unknown[] = [],
  Before extends string = '',
> = Sql extends `${infer Token} ${infer Rest}`
  ? Depth extends []
    ? IsKeyword<Token, 'from'> extends true
      ? { before: Trim<Before>; after: Trim<Rest> }
      : SplitAtFrom<Rest, ApplyParenDelta<Depth, Token>, `${Before} ${Token}`>
    : SplitAtFrom<Rest, ApplyParenDelta<Depth, Token>, `${Before} ${Token}`>
  : never;

type MalformedSelect<Sql extends string> = {
  code: 'MALFORMED_QUERY';
  message: 'malformed SELECT query';
  severity: 'fatal';
  location: { kind: 'statement'; reference: Sql };
};

type ParseFatal<Sql extends string> = {
  kind: 'fatal';
  readonly __value?: SelectQueryIR;
  diagnostics: [MalformedSelect<Sql>];
};

type ParseBody<Body extends string, Sql extends string> =
  SplitAtFrom<Body> extends {
    before: infer Projection extends string;
    after: infer Source extends string;
  }
    ? Projection extends ''
      ? ParseFatal<Sql>
      : [ParseRootSource<Source>] extends [never]
        ? ParseFatal<Sql>
        : ParseRootSource<Source> extends infer RootSource extends TableSourceIR
          ? {
              kind: 'ok';
              value: SelectQueryIR<
                [RootSource],
                ParseProjectionList<Projection>,
                [],
                [],
                []
              >;
              diagnostics: [];
            }
          : ParseFatal<Sql>
    : ParseFatal<Sql>;

type ParseNormalized<Normalized extends string, Sql extends string> =
  Normalized extends `${infer Select} ${infer Body}`
    ? IsKeyword<Select, 'select'> extends true
      ? ParseBody<Body, Sql>
      : ParseFatal<Sql>
    : ParseFatal<Sql>;

export type ParseSelectIR<Sql extends string> = ParseNormalized<Normalize<Sql>, Sql>;
