export interface CteIR<
  Name extends string = string,
  Columns extends readonly string[] | null = null,
  Query = unknown,
  Recursive extends boolean = false,
> {
  name: Name;
  columns: Columns;
  query: Query;
  recursive: Recursive;
}

export type AnyCteIR = CteIR<
  string,
  readonly string[] | null,
  unknown,
  boolean
>;
