import type { Params } from '../src/index.js';

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2)
    ? true
    : false;

type Expect<T extends true> = T;

interface DB {
  users: { id: number; name: string; parent_id: number };
}

type OutOfOrderPlaceholdersBindByIndex = Expect<
  Equal<
    Params<DB, 'select id from users where name = $2 and id = $1'>,
    [number, string]
  >
>;

type RepeatedPlaceholderOccupiesOneSlot = Expect<
  Equal<
    Params<DB, 'select id from users where id = $1 or parent_id = $1'>,
    [number]
  >
>;

type GapLeavesUnknownSlot = Expect<
  Equal<Params<DB, 'select id from users where name = $2'>, [unknown, string]>
>;

type DoubleDigitIndexResolves = Expect<
  Equal<
    Params<
      DB,
      'select id from users where id = $10 and name = $1'
    >['length'],
    10
  >
>;

type QuestionMarksStaySequential = Expect<
  Equal<
    Params<DB, 'select id from users where id = ? and name = ?'>,
    [number, string]
  >
>;

type NamedAtParamsStaySequential = Expect<
  Equal<
    Params<DB, 'select id from users where id = @id and name = @name'>,
    [number, string]
  >
>;

type RepeatedNamedAtPlaceholderOccupiesOneSlot = Expect<
  Equal<Params<DB, 'select id from users where id = @id or parent_id = @id'>, [number]>
>;

type RepeatedNamedDollarPlaceholderOccupiesOneSlot = Expect<
  Equal<Params<DB, 'select id from users where id = $id or parent_id = $id'>, [number]>
>;

type MixedQuestionMarksAndRepeatedNamedPlaceholderBindCorrectly = Expect<
  Equal<
    Params<DB, 'select id from users where name = ? and id = @id or parent_id = @id'>,
    [string, number]
  >
>;

type SystemVariableIsNotPlaceholder = Expect<
  Equal<Params<DB, 'select id from users where id = @@rowcount'>, []>
>;

// Regression for #228: two *distinct* named dollar placeholders each need their
// own slot. They used to share slot 0 of the numbered bucket, so their types
// were intersected into `never` and the query became impossible to call.
type DistinctNamedDollarPlaceholdersGetTheirOwnSlots = Expect<
  Equal<
    Params<DB, 'select id from users where id = $id and name = $nm'>,
    [number, string]
  >
>;

// Regression for #238: `:name` is bound by the node:sqlite adapter, so the
// type layer has to see it too - it used to produce an empty tuple.
type ColonNamedParamsGetSlots = Expect<
  Equal<
    Params<DB, 'select id from users where id = :id and name = :nm'>,
    [number, string]
  >
>;

type RepeatedColonNamedPlaceholderOccupiesOneSlot = Expect<
  Equal<Params<DB, 'select id from users where id = :id or parent_id = :id'>, [number]>
>;

type CastIsNotAColonPlaceholder = Expect<
  Equal<Params<DB, 'select id from users where name = id::text'>, []>
>;

// Same root cause: a Postgres cast attached to a numbered placeholder made the
// index unreadable, so `$2::int` no longer bound to the second slot.
type CastOnNumberedPlaceholderStillBindsByIndex = Expect<
  Equal<
    Params<DB, 'select id from users where id = $2::int and name = $1'>,
    [string, number]
  >
>;

type CastOnFirstNumberedPlaceholderStillBindsByIndex = Expect<
  Equal<
    Params<DB, 'select id from users where id = $1::int and name = $2'>,
    [number, string]
  >
>;

type InsertOutOfOrderPlaceholdersBindByIndex = Expect<
  Equal<
    Params<DB, 'insert into users (id, name) values ($2, $1)'>,
    [string, number]
  >
>;

type InsertInOrderStillWorks = Expect<
  Equal<
    Params<DB, 'insert into users (id, name) values ($1, $2)'>,
    [number, string]
  >
>;

export type Assertions = [
  OutOfOrderPlaceholdersBindByIndex,
  RepeatedPlaceholderOccupiesOneSlot,
  GapLeavesUnknownSlot,
  DoubleDigitIndexResolves,
  QuestionMarksStaySequential,
  NamedAtParamsStaySequential,
  RepeatedNamedAtPlaceholderOccupiesOneSlot,
  RepeatedNamedDollarPlaceholderOccupiesOneSlot,
  MixedQuestionMarksAndRepeatedNamedPlaceholderBindCorrectly,
  SystemVariableIsNotPlaceholder,
  DistinctNamedDollarPlaceholdersGetTheirOwnSlots,
  ColonNamedParamsGetSlots,
  RepeatedColonNamedPlaceholderOccupiesOneSlot,
  CastIsNotAColonPlaceholder,
  CastOnNumberedPlaceholderStillBindsByIndex,
  CastOnFirstNumberedPlaceholderStillBindsByIndex,
  InsertOutOfOrderPlaceholdersBindByIndex,
  InsertInOrderStillWorks,
];
