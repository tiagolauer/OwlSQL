export interface ColumnProjectionIR<
  Qualifier extends string | null = string | null,
  Name extends string = string,
  OutputName extends string = Name,
> {
  kind: 'column';
  qualifier: Qualifier;
  name: Name;
  outputName: OutputName;
}

export interface StarProjectionIR<
  Qualifier extends string | null = null,
> {
  kind: 'star';
  qualifier: Qualifier;
}

export interface ExpressionProjectionIR<
  Fragment extends string = string,
  OutputName extends string = string,
> {
  kind: 'expression';
  fragment: Fragment;
  outputName: OutputName;
}

export type ProjectionIR =
  | ColumnProjectionIR
  | ExpressionProjectionIR
  | StarProjectionIR<string | null>;
