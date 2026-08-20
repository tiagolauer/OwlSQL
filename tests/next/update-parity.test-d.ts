import type {
  LegacyInferParams,
  LegacyInferResult,
  LegacyInferResultStrict,
} from '../../src/compiler/legacy.js';
import type {
  NextUpdateInferParams,
  NextUpdateQuery,
  NextUpdateStrictQuery,
} from '../../src/compiler/next/index.js';

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends
  (<T>() => T extends B ? 1 : 2) ? true : false;

type Expect<T extends true> = T;

type DB = {
  users: {
    id: number;
    name: string;
    email: string | null;
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
  NextUpdateQuery<DB, Sql>
>;

type StrictParity<Sql extends string> = Equal<
  LegacyInferResultStrict<DB, Sql>,
  NextUpdateStrictQuery<DB, Sql>
>;

type ParamsParity<Sql extends string> = Equal<
  LegacyInferParams<DB, Sql>,
  NextUpdateInferParams<DB, Sql>
>;

type Simple = Expect<Parity<'update users set name = $1 where id = $2'>>;
type Returning = Expect<Parity<'update users set name = $1 returning id, name'>>;
type ReturningStar = Expect<Parity<'update users set name = $1 returning *'>>;
type Output = Expect<Parity<'update users set name = @name output inserted.id where id = @id'>>;
type OutputBeforeFrom = Expect<StrictParity<
  'update users set name = @name output inserted.id from accounts where accounts.user_id = users.id'
>>;
type Alias = Expect<StrictParity<
  'update users as u set name = $1 where u.id = $2 returning u.id'
>>;
type BareAlias = Expect<StrictParity<
  'update users u set name = $1 where u.id = $2 returning u.id'
>>;
type SchemaQualified = Expect<Parity<
  'update public.users set name = $1 where id = $2 returning id'
>>;
type UnknownTarget = Expect<StrictParity<'update ghosts set name = $1'>>;
type UnknownAssignment = Expect<StrictParity<
  'update users set naem = $1 where id = 1'
>>;
type UnknownLaterAssignment = Expect<StrictParity<
  'update users set name = $1, naem = $2 where id = 1'
>>;
type UnknownWhere = Expect<StrictParity<
  'update users set name = $1 where nope = $2'
>>;
type UnknownReturning = Expect<StrictParity<
  'update users set name = $1 returning nope'
>>;
type UpdateFrom = Expect<StrictParity<
  'update users set name = name from accounts where accounts.user_id = users.id returning users.id'
>>;
type UnknownFromAlias = Expect<StrictParity<
  'update users set name = name from accounts where ghosts.id = users.id returning users.id'
>>;
type JoinOn = Expect<StrictParity<
  'update users set name = name from accounts a join refunds r on r.account_id = a.id where a.user_id = users.id returning users.id'
>>;
type UnknownJoinOn = Expect<StrictParity<
  'update users set name = name from accounts a join refunds r on r.nope = a.id where a.user_id = users.id returning users.id'
>>;
type ScalarAssignment = Expect<StrictParity<
  'update users set name = (select name from users where id = 1) where id = 2'
>>;
type ScalarAssignmentTypo = Expect<StrictParity<
  'update users set name = (select nope from users where id = 1) where id = 2'
>>;
type AssignmentParams = Expect<ParamsParity<
  'update users set name = $1, email = $2 where id = $3'
>>;
type NamedParams = Expect<ParamsParity<
  'update users set name = @name where id = @id'
>>;
type FromParams = Expect<ParamsParity<
  'update users set name = $1 from accounts where accounts.user_id = users.id and accounts.balance > $2'
>>;
type LooseUnknownAssignment = Expect<Parity<
  'update users set nope = $1'
>>;

export type UpdateParityLock = [
  Simple,
  Returning,
  ReturningStar,
  Output,
  OutputBeforeFrom,
  Alias,
  BareAlias,
  SchemaQualified,
  UnknownTarget,
  UnknownAssignment,
  UnknownLaterAssignment,
  UnknownWhere,
  UnknownReturning,
  UpdateFrom,
  UnknownFromAlias,
  JoinOn,
  UnknownJoinOn,
  ScalarAssignment,
  ScalarAssignmentTypo,
  AssignmentParams,
  NamedParams,
  FromParams,
  LooseUnknownAssignment,
];
