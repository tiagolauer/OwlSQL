import type { WriteTargetIR } from '../../language/ir/write.js';
import type { TableSourceIR } from '../../language/ir/source.js';
import type { Diagnostic } from '../contracts/diagnostic.js';
import type { ResolveKey } from '../schema/model.js';
import type { ResolveError, ResolveOk } from './resolve-source.js';

type UnknownTable<Name extends string> = Diagnostic<
  'UNKNOWN_TABLE',
  `unknown table: ${Name}`,
  'error',
  'from',
  Name
>;

type UnknownColumn<Name extends string> = Diagnostic<
  'UNKNOWN_COLUMN',
  `unknown column: ${Name}`,
  'error',
  'statement',
  Name
>;

export type ResolveWriteTarget<
  DB,
  Target extends WriteTargetIR,
> = ResolveKey<DB, Target['name']> extends never
  ? ResolveError<UnknownTable<Target['name']>>
  : ResolveOk<
      TableSourceIR<Target['name'], Target['alias'], false, 'root', []>
    >;

export type ResolveWriteColumn<
  DB,
  Target extends WriteTargetIR,
  Column extends string,
> = ResolveKey<DB, Target['name']> extends infer Table
  ? [Table] extends [never]
    ? ResolveError<UnknownTable<Target['name']>>
    : Table extends keyof DB
      ? ResolveKey<DB[Table], Column> extends infer Key
        ? [Key] extends [never]
          ? ResolveError<UnknownColumn<Column>>
          : Key extends keyof DB[Table]
            ? ResolveOk<DB[Table][Key]>
            : never
        : never
      : never
  : never;
