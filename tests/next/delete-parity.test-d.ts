import type {
  LegacyInferParams,
  LegacyInferResult,
  LegacyInferResultStrict,
} from '../../src/compiler/legacy.js';
import type {
  NextDeleteInferParams,
  NextDeleteQuery,
  NextDeleteStrictQuery,
} from '../../src/compiler/next/index.js';

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends
  (<T>() => T extends B ? 1 : 2) ? true : false;

type Expect<T extends true> = T;

type DB = {
  users: {
    id: number;
    name: string;
  };
  accounts: {
    id: number;
    user_id: number;
    balance: number;
  };
  refunds: {
    id: number;
    account_id: number;
  };
};

type Parity<Sql extends string> = Equal<
  LegacyInferResult<DB, Sql>,
  NextDeleteQuery<DB, Sql>
>;

type StrictParity<Sql extends string> = Equal<
  LegacyInferResultStrict<DB, Sql>,
  NextDeleteStrictQuery<DB, Sql>
>;

type ParamsParity<Sql extends string> = Equal<
  LegacyInferParams<DB, Sql>,
  NextDeleteInferParams<DB, Sql>
>;

type Simple = Expect<Parity<'delete from users where id = $1'>>;
type NoPredicate = Expect<Parity<'delete from users'>>;
type Returning = Expect<Parity<'delete from users where id = $1 returning id, name'>>;
type Output = Expect<Parity<'delete from users output deleted.id where id = @id'>>;
type Alias = Expect<StrictParity<
  'delete from users as u where u.id = $1 returning u.name'
>>;
type BareAlias = Expect<StrictParity<
  'delete from users u where u.id = $1 returning u.name'
>>;
type SchemaQualified = Expect<Parity<
  'delete from public.users where id = $1 returning name'
>>;
type UnknownTarget = Expect<StrictParity<'delete from ghosts'>>;
type UnknownWhere = Expect<StrictParity<
  'delete from users where nope = $1'
>>;
type UnknownReturning = Expect<StrictParity<
  'delete from users returning nope'
>>;
type DeleteUsing = Expect<StrictParity<
  'delete from users using accounts where accounts.user_id = users.id and accounts.balance < 0 returning users.id'
>>;
type UnknownUsingAlias = Expect<StrictParity<
  'delete from users using accounts where ghosts.id = users.id returning users.id'
>>;
type UsingJoin = Expect<StrictParity<
  'delete from users using accounts a join refunds r on r.account_id = a.id where a.user_id = users.id returning users.id'
>>;
type UnknownJoinOn = Expect<StrictParity<
  'delete from users using accounts a join refunds r on r.nope = a.id where a.user_id = users.id returning users.id'
>>;
type Params = Expect<ParamsParity<
  'delete from users where id = $1 and name = $2'
>>;
type NamedParams = Expect<ParamsParity<
  'delete from users where id = @id and name = @name'
>>;
type UsingParams = Expect<ParamsParity<
  'delete from users using accounts where accounts.user_id = users.id and accounts.balance < $1'
>>;
type LooseUnknownColumn = Expect<Parity<
  'delete from users where nope = $1 returning nope'
>>;

export type DeleteParityLock = [
  Simple,
  NoPredicate,
  Returning,
  Output,
  Alias,
  BareAlias,
  SchemaQualified,
  UnknownTarget,
  UnknownWhere,
  UnknownReturning,
  DeleteUsing,
  UnknownUsingAlias,
  UsingJoin,
  UnknownJoinOn,
  Params,
  NamedParams,
  UsingParams,
  LooseUnknownColumn,
];
