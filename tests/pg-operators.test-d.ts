import type { Params } from '../src/index.js';
import type { UsedPlaceholderStyles } from '../src/language/lexical/placeholders.js';

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;

type Expect<T extends true> = T;

interface DB {
  users: { id: number; tags: string[]; data: unknown; 'user@id': string };
}

// Regression for #249: `@>` starts with a placeholder prefix but carries no
// name, so it was counted as a named parameter and reported the query as
// using the `at` style - which fails the check against a dollar executor.
type ContainmentOperatorIsNotAParameter = Expect<
  Equal<Params<DB, 'select id from users where tags @> $1'>, [string[]]>
>;

type ContainedByOperatorIsNotAParameter = Expect<
  Equal<Params<DB, 'select id from users where tags <@ $1'>, [string[]]>
>;

type ContainmentKeepsTheDollarStyleAlone = Expect<
  Equal<UsedPlaceholderStyles<'select id from users where tags @> $1'>, 'dollar'>
>;

type ContainedByKeepsTheDollarStyleAlone = Expect<
  Equal<UsedPlaceholderStyles<'select id from users where tags <@ $1'>, 'dollar'>
>;

type JsonbAnyKeyOperatorIsNotAQuestionStyle = Expect<
  Equal<UsedPlaceholderStyles<'select id from users where data ?| $1'>, 'dollar'>
>;

type JsonbAllKeysOperatorIsNotAQuestionStyle = Expect<
  Equal<UsedPlaceholderStyles<'select id from users where data ?& $1'>, 'dollar'>
>;

type JsonPathOperatorIsNotAParameter = Expect<
  Equal<Params<DB, "select id from users where data #> '{a}' = $1">, [string]>
>;

// A quoted identifier is left intact by Normalize on purpose, so its body has
// to be masked before the style scan.
type QuotedIdentifierIsNotAPlaceholderStyle = Expect<
  Equal<UsedPlaceholderStyles<'select "user@id" from users where id = $1'>, 'dollar'>
>;

// The styles themselves still resolve.
type DollarStyleStillDetected = Expect<
  Equal<UsedPlaceholderStyles<'select id from users where id = $1'>, 'dollar'>
>;

type AtStyleStillDetected = Expect<
  Equal<UsedPlaceholderStyles<'select id from users where id = @id'>, 'at'>
>;

type QuestionStyleStillDetected = Expect<
  Equal<UsedPlaceholderStyles<'select id from users where id = ?'>, 'question'>
>;

type SystemVariableStillIgnored = Expect<
  Equal<UsedPlaceholderStyles<'select id from users where id = @@rowcount'>, never>
>;

type MergeActionStillIgnored = Expect<
  Equal<UsedPlaceholderStyles<'merge into users output $action'>, never>
>;

type OperatorStillTakesNoParameterSlot = Expect<
  Equal<Params<DB, 'select id from users where tags @> $1 and id = $2'>, [string[], number]>
>;

export type Assertions = [
  ContainmentOperatorIsNotAParameter,
  ContainedByOperatorIsNotAParameter,
  ContainmentKeepsTheDollarStyleAlone,
  ContainedByKeepsTheDollarStyleAlone,
  JsonbAnyKeyOperatorIsNotAQuestionStyle,
  JsonbAllKeysOperatorIsNotAQuestionStyle,
  JsonPathOperatorIsNotAParameter,
  QuotedIdentifierIsNotAPlaceholderStyle,
  DollarStyleStillDetected,
  AtStyleStillDetected,
  QuestionStyleStillDetected,
  SystemVariableStillIgnored,
  MergeActionStillIgnored,
  OperatorStillTakesNoParameterSlot,
];
