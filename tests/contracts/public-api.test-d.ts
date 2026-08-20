import type {
  DialectExecutor,
  Err,
  Executor,
  ExecutorResult,
  FunctionReturnTypes,
  InferParams,
  InferResult,
  InferResultStrict,
  InferRow,
  InferRowStrict,
  Ok,
  Params,
  ParseSelect,
  ParseStatement,
  ParsedStatement,
  PlaceholderStyle,
  Query,
  QueryError,
  QueryMeta,
  QueryTypeError,
  Result,
  Row,
  Schema,
  SchemaLike,
  Source,
  StrictQuery,
  StrictRow,
  TypedDb,
  TypedDbOptions,
} from '../../src/index.js';

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends
  (<T>() => T extends B ? 1 : 2) ? true : false;

type Expect<T extends true> = T;

interface DB {
  users: {
    id: number;
    name: string;
    email: string | null;
    active: boolean;
  };
  profiles: {
    id: number;
    user_id: number;
    avatar: string;
  };
}

type QueryContract = Expect<
  Equal<
    Query<DB, 'select id, name from users'>,
    { id: number; name: string }[]
  >
>;

type RowContract = Expect<
  Equal<Row<DB, 'select id, email from users'>, { id: number; email: string | null }>
>;

type ParamsContract = Expect<
  Equal<Params<DB, 'select id from users where id = $1 and active = $2'>, [number, boolean]>
>;

type JoinNullabilityContract = Expect<
  Equal<
    Query<
      DB,
      'select users.id, profiles.avatar from users left join profiles on profiles.user_id = users.id'
    >,
    { id: number; avatar: string | null }[]
  >
>;

type StrictErrorContract = Expect<
  Equal<
    StrictQuery<DB, 'select nope from users'>,
    QueryTypeError<'unknown column: nope'>[]
  >
>;

type StrictRowErrorContract = Expect<
  Equal<
    StrictRow<DB, 'select nope from users'>,
    QueryTypeError<'unknown column: nope'>
  >
>;

declare const typedDb: TypedDb<DB>;
void typedDb;

export type PublicApiContractLock = [
  QueryContract,
  RowContract,
  ParamsContract,
  JoinNullabilityContract,
  StrictErrorContract,
  StrictRowErrorContract,
];
