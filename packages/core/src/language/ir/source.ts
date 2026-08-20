export type JoinKind = 'root' | 'inner' | 'left' | 'right' | 'full' | 'cross';

export interface TableSourceIR<
  Name extends string = string,
  Alias extends string = Name,
  Nullable extends boolean = false,
  Join extends JoinKind = 'root',
  MergedColumns extends readonly string[] = [],
> {
  kind: 'table';
  name: Name;
  alias: Alias;
  join: Join;
  nullable: Nullable;
  mergedColumns: MergedColumns;
}

export interface DerivedSourceIR<
  Alias extends string = string,
  Query = unknown,
  Nullable extends boolean = false,
  Join extends JoinKind = 'root',
> {
  kind: 'derived';
  alias: Alias;
  query: Query;
  join: Join;
  nullable: Nullable;
}

export interface CteSourceIR<
  Name extends string = string,
  Row = unknown,
  Alias extends string = Name,
  Nullable extends boolean = false,
  Join extends JoinKind = 'root',
  MergedColumns extends readonly string[] = [],
> extends DerivedSourceIR<Alias, Row, Nullable, Join> {
  name: Name;
  mergedColumns: MergedColumns;
}

export type AnyCteSourceIR = CteSourceIR<
  string,
  unknown,
  string,
  boolean,
  JoinKind,
  readonly string[]
>;

export type SourceIR =
  | TableSourceIR<string, string, boolean, JoinKind, readonly string[]>
  | DerivedSourceIR<string, unknown, boolean, JoinKind>;
