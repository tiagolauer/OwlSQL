export type Schema = Record<string, Record<string, unknown>>;

export type SchemaLike = object;

export type ResolveKey<T, Name extends string> = Name extends keyof T
  ? Name
  : {
      [Key in keyof T]: Key extends string
        ? Lowercase<Key> extends Lowercase<Name>
          ? Key
          : never
        : never;
    }[keyof T];

export type TableRow<DB, Name extends string> =
  ResolveKey<DB, Name> extends infer Key extends keyof DB ? DB[Key] : never;

export type ColumnValue<Row, Name extends string> =
  ResolveKey<Row, Name> extends infer Key extends keyof Row ? Row[Key] : never;
