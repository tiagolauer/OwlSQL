import type { Params } from '../src/index.js';

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;

type Expect<T extends true> = T;

interface DB {
  users: { id: number; name: string; created_at: Date };
}

// Regression for #244: the scan splits on spaces, so a placeholder written
// inside a call was part of one unrecognized token and got no tuple slot -
// the query could not be called with the value the driver demands.
type PlaceholderInsideAFunctionCall = Expect<
  Equal<Params<DB, 'select id from users where lower(name) = lower($1)'>, [string]>
>;

type PlaceholderInsideANestedCall = Expect<
  Equal<Params<DB, 'select id from users where name = lower(trim($1))'>, [string]>
>;

type PlaceholderInsideCoalesce = Expect<
  Equal<Params<DB, 'select id from users where id = coalesce($1, 0)'>, [number]>
>;

type NamedPlaceholderInsideACall = Expect<
  Equal<Params<DB, 'select id from users where id = coalesce(@id, 0)'>, [number]>
>;

type QuestionMarkInsideACall = Expect<
  Equal<Params<DB, 'select id from users where name = lower(?)'>, [string]>
>;

// `= any($1)` binds the whole list, so the slot is an array of the column's
// type rather than one element of it.
type AnyBindsAnArray = Expect<
  Equal<Params<DB, 'select id from users where id = any($1)'>, [number[]]>
>;

type AnyWithACastBindsAnArray = Expect<
  Equal<Params<DB, 'select id from users where id = any($1::int[])'>, [number[]]>
>;

type AllBindsAnArray = Expect<
  Equal<Params<DB, 'select id from users where id = all($1)'>, [number[]]>
>;

// A call is not an array wrapper just because it holds the placeholder.
type OtherCallsKeepTheColumnType = Expect<
  Equal<Params<DB, 'select id from users where created_at = date_trunc($1)'>, [Date]>
>;

// Two placeholders glued into one token stay outside the typed set, matching
// the documented "write it with spaces" rule.
type TwoPlaceholdersInOneTokenAreLeftAlone = Expect<
  Equal<Params<DB, 'select id from users where id = coalesce($1,$2)'>, []>
>;

// Shapes that already worked keep working.
type ParenthesizedListStillBinds = Expect<
  Equal<Params<DB, 'select id from users where id in ($1, $2)'>, [number, number]>
>;

type StarArgumentIsNotAPlaceholder = Expect<
  Equal<Params<DB, 'select count(*) as total from users where id = $1'>, [number]>
>;

type PlainCallWithoutAPlaceholder = Expect<
  Equal<Params<DB, 'select id from users where lower(name) = lower(name)'>, []>
>;

export type Assertions = [
  PlaceholderInsideAFunctionCall,
  PlaceholderInsideANestedCall,
  PlaceholderInsideCoalesce,
  NamedPlaceholderInsideACall,
  QuestionMarkInsideACall,
  AnyBindsAnArray,
  AnyWithACastBindsAnArray,
  AllBindsAnArray,
  OtherCallsKeepTheColumnType,
  TwoPlaceholdersInOneTokenAreLeftAlone,
  ParenthesizedListStillBinds,
  StarArgumentIsNotAPlaceholder,
  PlainCallWithoutAPlaceholder,
];
