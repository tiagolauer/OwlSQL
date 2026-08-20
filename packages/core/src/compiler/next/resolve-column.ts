import type {
  DerivedSourceIR,
  JoinKind,
  SourceIR,
  TableSourceIR,
} from '../../language/ir/source.js';
import type { ColumnValue, ResolveKey } from '../../schema/model.js';
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
  Source extends TableSourceIR<string, string, boolean, JoinKind, readonly string[]>,
  Column extends string,
> = ResolveKey<DB, Source['name']> extends never
  ? ResolveError<UnknownTable<Source['name']>>
  : ResolveKey<DB, Source['name']> extends infer Table extends keyof DB
    ? ResolveKey<DB[Table], Column> extends infer Key
      ? [Key] extends [never]
        ? ResolveError<UnknownColumn<Column>>
        : Key extends keyof DB[Table]
          ? ResolveOk<WithNullability<DB[Table][Key], Source['nullable']>>
          : never
      : never
    : never;

type ResolveDerivedColumn<
  Source extends DerivedSourceIR<string, unknown, boolean, JoinKind>,
  Column extends string,
> = ResolveKey<Source['query'], Column> extends never
  ? ResolveError<UnknownColumn<Column>>
  : ResolveOk<
      WithNullability<
        ColumnValue<Source['query'], Column>,
        Source['nullable']
      >
    >;

type ResolveSourceColumn<
  DB,
  Source extends SourceIR,
  Column extends string,
> = Source extends TableSourceIR<
  string,
  string,
  boolean,
  JoinKind,
  readonly string[]
>
  ? ResolveTableColumn<DB, Source, Column>
  : Source extends DerivedSourceIR<string, unknown, boolean, JoinKind>
    ? ResolveDerivedColumn<Source, Column>
    : never;

type ResolveQualified<
  DB,
  CurrentScope,
  Qualifier extends string,
  Column extends string,
> = ResolveBinding<CurrentScope, Qualifier> extends infer Binding
  ? Binding extends ResolveOk<infer Source extends SourceIR>
    ? ResolveSourceColumn<DB, Source, Column>
    : Binding
  : never;

type Includes<
  Values extends readonly string[],
  Name extends string,
> = Values extends readonly [
  infer Head extends string,
  ...infer Tail extends string[],
]
  ? Lowercase<Head> extends Lowercase<Name>
    ? true
    : Includes<Tail, Name>
  : false;

type IsMerged<Source extends SourceIR, Column extends string> =
  Source extends TableSourceIR<
    string,
    string,
    boolean,
    JoinKind,
    infer Merged
  >
    ? Includes<Merged, Column>
    : false;

type LocalColumnMatches<
  DB,
  Sources extends readonly SourceIR[],
  Column extends string,
  Matches extends unknown[] = [],
> = Sources extends readonly [
  infer Head extends SourceIR,
  ...infer Tail extends SourceIR[],
]
  ? ResolveSourceColumn<DB, Head, Column> extends infer Resolution
    ? Resolution extends ResolveOk<infer Value>
      ? IsMerged<Head, Column> extends true
        ? LocalColumnMatches<DB, Tail, Column, Matches>
        : LocalColumnMatches<DB, Tail, Column, [...Matches, Value]>
      : LocalColumnMatches<DB, Tail, Column, Matches>
    : never
  : Matches;

type ResolveUnqualified<
  DB,
  CurrentScope,
  Column extends string,
> = CurrentScope extends Scope<infer Sources, infer Parent>
  ? LocalColumnMatches<DB, Sources, Column> extends infer Matches extends unknown[]
    ? Matches extends [infer Value]
      ? ResolveOk<Value>
      : Matches extends [infer First, unknown, ...unknown[]]
        ? ResolveError<AmbiguousColumn<Column>, First>
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
