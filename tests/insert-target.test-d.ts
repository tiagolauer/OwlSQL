import type { Params, StrictRow, Row } from '../src/index.js';

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;

type Expect<T extends true> = T;

interface DB {
  users: { id: number; name: string };
}

// Regression for #245: the target is a space-delimited word, so a column list
// glued to it (`users(id, name)`) was read as part of the table name - the
// statement's source became `users(id,` and the column list was never found.
type GluedColumnListStillTypesParams = Expect<
  Equal<Params<DB, 'insert into users(id, name) values ($1, $2)'>, [number, string]>
>;

type GluedColumnListStillResolvesTheTarget = Expect<
  Equal<StrictRow<DB, 'insert into users(id, name) values ($1, $2) returning id'>, { id: number }>
>;

type GluedColumnListWithSchemaQualifiedTarget = Expect<
  Equal<Params<DB, 'insert into public.users(id, name) values ($1, $2)'>, [number, string]>
>;

type GluedColumnListWithQuotedTarget = Expect<
  Equal<Params<DB, 'insert into "users"(id, name) values ($1, $2)'>, [number, string]>
>;

type SpacedColumnListStillWorks = Expect<
  Equal<Params<DB, 'insert into users (id, name) values ($1, $2)'>, [number, string]>
>;

type GluedMultiRowValues = Expect<
  Equal<
    Params<DB, 'insert into users(id, name) values ($1, $2), ($3, $4)'>,
    [number, string, number, string]
  >
>;

type GluedColumnListLooseRow = Expect<
  Equal<Row<DB, 'insert into users(id, name) values ($1, $2) returning name'>, { name: string }>
>;

export type Assertions = [
  GluedColumnListStillTypesParams,
  GluedColumnListStillResolvesTheTarget,
  GluedColumnListWithSchemaQualifiedTarget,
  GluedColumnListWithQuotedTarget,
  SpacedColumnListStillWorks,
  GluedMultiRowValues,
  GluedColumnListLooseRow,
];
