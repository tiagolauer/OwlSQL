import type { IsKeyword, Normalize, Unquote } from '../../string.js';
import type { TableSourceIR } from '../ir/source.js';

type ParseWords<Sql extends string> =
  Normalize<Sql> extends `${infer Name} ${infer As} ${infer Alias}`
    ? Alias extends `${string} ${string}`
      ? never
      : IsKeyword<As, 'as'> extends true
        ? TableSourceIR<Unquote<Name>, Unquote<Alias>>
        : never
    : Normalize<Sql> extends `${infer Name} ${infer Alias}`
      ? TableSourceIR<Unquote<Name>, Unquote<Alias>>
      : Normalize<Sql> extends infer Name extends string
        ? Name extends ''
          ? never
          : TableSourceIR<Unquote<Name>, Unquote<Name>>
        : never;

export type ParseRootSource<Sql extends string> = ParseWords<Sql>;
