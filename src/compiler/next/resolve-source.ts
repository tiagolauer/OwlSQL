import type { Diagnostic } from '../contracts/diagnostic.js';
import type { SourceIR } from '../../language/ir/source.js';
import type { Scope } from './scope.js';

export type ResolveOk<Value> = { kind: 'ok'; value: Value };

export type ResolveError<Error extends Diagnostic> = {
  kind: 'error';
  diagnostic: Error;
};

type Matches<Source extends SourceIR, Name extends string> =
  Lowercase<Source['alias']> extends Lowercase<Name>
    ? true
    : Source extends { name: infer Table extends string }
      ? Lowercase<Table> extends Lowercase<Name>
        ? true
        : false
      : false;

type FindLocal<
  Sources extends readonly SourceIR[],
  Name extends string,
> = Sources extends readonly [
  infer Head extends SourceIR,
  ...infer Tail extends SourceIR[],
]
  ? Matches<Head, Name> extends true
    ? Head
    : FindLocal<Tail, Name>
  : never;

type UnknownAlias<Name extends string> = Diagnostic<
  'UNKNOWN_ALIAS',
  `unknown alias: ${Name}`,
  'error',
  'from',
  Name
>;

export type ResolveBinding<
  CurrentScope,
  Name extends string,
> = CurrentScope extends Scope<infer Sources, infer Parent>
  ? [FindLocal<Sources, Name>] extends [never]
    ? Parent extends Scope<readonly SourceIR[], unknown>
      ? ResolveBinding<Parent, Name>
      : ResolveError<UnknownAlias<Name>>
    : ResolveOk<FindLocal<Sources, Name>>
  : ResolveError<UnknownAlias<Name>>;
