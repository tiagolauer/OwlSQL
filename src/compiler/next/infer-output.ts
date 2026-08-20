import type { OutputIR } from '../../language/ir/write.js';
import type { ProjectionIR } from '../../language/ir/projection.js';
import type { CompileOk } from '../contracts/compilation.js';
import type { Diagnostic } from '../contracts/diagnostic.js';
import type { InferProjections } from './infer-projection.js';

type EmptyWriteRow = Record<string, never>;

export type InferOutput<
  DB,
  CurrentScope,
  Output extends OutputIR<
    'none' | 'returning' | 'output',
    readonly ProjectionIR[]
  >,
> =
  Output['mode'] extends 'none'
    ? CompileOk<EmptyWriteRow[], []>
    : InferProjections<
          DB,
          CurrentScope,
          Output['projections']
        > extends {
          row: infer Row;
          diagnostics: infer Diagnostics extends readonly Diagnostic[];
        }
      ? CompileOk<Row[], Diagnostics>
      : never;
