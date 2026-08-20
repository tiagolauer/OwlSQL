import type { SourceIR, TableSourceIR } from '../../language/ir/source.js';
import type { ColumnValue, ResolveKey, TableRow } from '../schema/model.js';
import type { Diagnostic } from '../contracts/diagnostic.js';
import type { Scope } from './scope.js';
import type {
  ResolveBinding,
  ResolveError,
  ResolveOk,
} from './resolve-source.js';

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
  'select',
  Name
>;

type AmbiguousColumn<Name extends string> = Diagnostic<
  'AMBIGUOUS_COLUMN',
  `ambiguous column: ${Name}`,
  'error',
  'select',
  Name
>;

type WithNullability<Value, Nullable extends boolean> =
  Nullable extends true ? Value | null : Value;

type ResolveTableColumn<
  DB,
  Source extends TableSourceIR,
  Column extends string,
> = ResolveKey<DB, Source['name']> extends never
  ? ResolveError<UnknownTable<Source['name']>>
  : ResolveKey<TableRow<DB, Source['name']>, Column> extends never
    ? ResolveError<UnknownColumn<Column>>
    : ResolveOk<
        WithNullability<
          ColumnValue<TableRow<DB, Source['name']>, Column>,
          Source['nullable']
        >
      >;

type ResolveQualified<
  DB,
  CurrentScope,
  Qualifier extends string,
  Column extends string,
> = ResolveBinding<CurrentScope, Qualifier> extends infer Binding
  ? Binding extends ResolveOk<infer Source extends TableSourceIR>
    ? ResolveTableColumn<DB, Source, Column>
    : Binding
  : never;

type LocalColumnMatches<
  DB,
  Sources extends readonly SourceIR[],
  Column extends string,
  Matches extends unknown[] = [],
> = Sources extends readonly [
  infer Head extends SourceIR,
  ...infer Tail extends SourceIR[],
]
  ? Head extends TableSourceIR
    ? ResolveKey<DB, Head['name']> extends never
      ? LocalColumnMatches<DB, Tail, Column, Matches>
      : ResolveKey<TableRow<DB, Head['name']>, Column> extends never
        ? LocalColumnMatches<DB, Tail, Column, Matches>
        : LocalColumnMatches<
            DB,
            Tail,
            Column,
            [
              ...Matches,
              WithNullability<
                ColumnValue<TableRow<DB, Head['name']>, Column>,
                Head['nullable']
              >,
            ]
          >
    : LocalColumnMatches<DB, Tail, Column, Matches>
  : Matches;

type ResolveUnqualified<
  DB,
  CurrentScope,
  Column extends string,
> = CurrentScope extends Scope<infer Sources, infer Parent>
  ? LocalColumnMatches<DB, Sources, Column> extends infer Matches extends unknown[]
    ? Matches extends [infer Value]
      ? ResolveOk<Value>
      : Matches extends [unknown, unknown, ...unknown[]]
        ? ResolveError<AmbiguousColumn<Column>>
        : Parent extends Scope<readonly SourceIR[], unknown>
          ? ResolveUnqualified<DB, Parent, Column>
          : ResolveError<UnknownColumn<Column>>
    : never
  : ResolveError<UnknownColumn<Column>>;

export type ResolveColumn<
  DB,
  CurrentScope,
  Qualifier extends string | null,
  Column extends string,
> = Qualifier extends string
  ? ResolveQualified<DB, CurrentScope, Qualifier, Column>
  : ResolveUnqualified<DB, CurrentScope, Column>;
