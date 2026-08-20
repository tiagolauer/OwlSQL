import type { Query, StrictRow } from '../src/index.js';

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2)
    ? true
    : false;

type Expect<T extends true> = T;

interface DB {
  users: {
    id: number;
    name: string;
  };
}

type StrictNumericLiteral = Expect<
  Equal<StrictRow<DB, 'select 1 as one from users'>, { one: number }>
>;

type StrictStringLiteral = Expect<
  Equal<StrictRow<DB, "select 'x' as tag from users">, { tag: string }>
>;

type StrictBooleanLiteral = Expect<
  Equal<StrictRow<DB, 'select true as flag from users'>, { flag: boolean }>
>;

type StrictNullLiteral = Expect<
  Equal<StrictRow<DB, 'select null as nothing from users'>, { nothing: null }>
>;

type StrictMixedLiteralsAndColumns = Expect<
  Equal<
    StrictRow<DB, "select id, 1 as flag, 'label' as kind from users">,
    { id: number; flag: number; kind: string }
  >
>;

type LooseNumericLiteral = Expect<
  Equal<Query<DB, 'select 2.5 as ratio from users'>, { ratio: number }[]>
>;

type NegativeNumericLiteral = Expect<
  Equal<Query<DB, 'select -1 as neg from users'>, { neg: number }[]>
>;

export type Assertions = [
  StrictNumericLiteral,
  StrictStringLiteral,
  StrictBooleanLiteral,
  StrictNullLiteral,
  StrictMixedLiteralsAndColumns,
  LooseNumericLiteral,
  NegativeNumericLiteral,
];
