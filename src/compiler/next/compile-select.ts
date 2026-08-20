import type { ProjectionIR, SelectQueryIR } from '../../language/ir/query.js';
import type { SourceIR } from '../../language/ir/source.js';
import type { ParseSelectIR } from '../../language/select/parse-select.js';
import type {
  CompileFatal,
  CompileOk,
} from '../contracts/compilation.js';
import type { Diagnostic } from '../contracts/diagnostic.js';
import type { InferProjections } from './infer-projection.js';
import type { RootScope } from './scope.js';

type CompileIR<
  DB,
  IR extends SelectQueryIR,
> = IR extends SelectQueryIR<
  infer Sources extends readonly SourceIR[],
  infer Projections extends readonly ProjectionIR[],
  readonly [],
  readonly [],
  readonly []
>
  ? InferProjections<DB, RootScope<Sources>, Projections> extends {
      row: infer Row;
      diagnostics: infer Diagnostics extends readonly Diagnostic[];
    }
    ? CompileOk<Row[], Diagnostics>
    : never
  : never;

export type CompileSelect<DB, Sql extends string> =
  ParseSelectIR<Sql> extends infer Parsed
    ? Parsed extends { kind: 'ok'; value: infer IR extends SelectQueryIR }
      ? CompileIR<DB, IR>
      : Parsed extends CompileFatal<SelectQueryIR, infer Diagnostics>
        ? CompileFatal<unknown[], Diagnostics>
        : never
    : never;
