import type { ApplyLoosePolicy } from '../../src/compiler/contracts/compilation.js';
import type {
  LegacyInferParams,
  LegacyInferResult,
  LegacyInferResultStrict,
} from '../../src/compiler/legacy.js';
import type { InferOutput } from '../../src/compiler/next/infer-output.js';
import type {
  ResolveWriteColumn,
  ResolveWriteTarget,
} from '../../src/compiler/next/resolve-write-target.js';
import type { RootScope } from '../../src/compiler/next/scope.js';
import type {
  NextInsertInferParams,
  NextInsertQuery,
  NextInsertStrictQuery,
} from '../../src/compiler/next/index.js';
import type { ColumnProjectionIR } from '../../src/language/ir/projection.js';
import type {
  AssignmentIR,
  OutputIR,
  WriteTargetIR,
} from '../../src/language/ir/write.js';

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
};

type Target = WriteTargetIR<'users', 'u'>;
type TargetSource = ResolveWriteTarget<DB, Target>;
type TargetScope = TargetSource extends { kind: 'ok'; value: infer Source }
  ? RootScope<[Source & { kind: 'table'; name: 'users'; alias: 'u'; join: 'root'; nullable: false; mergedColumns: [] }]>
  : never;

type TargetContract = Expect<
  Equal<Target, { kind: 'write-target'; name: 'users'; alias: 'u' }>
>;
type InsertColumnsContract = Expect<
  Equal<readonly ['id', 'name'] extends readonly string[] ? true : false, true>
>;
type AssignmentContract = Expect<
  Equal<AssignmentIR<'name', '$1'>, { target: 'name'; value: '$1' }>
>;
type ReturningContract = Expect<
  Equal<
    OutputIR<'returning', [ColumnProjectionIR<null, 'id', 'id'>]>,
    { mode: 'returning'; projections: [ColumnProjectionIR<null, 'id', 'id'>] }
  >
>;
type OutputContract = Expect<
  Equal<
    OutputIR<'output', [ColumnProjectionIR<null, 'name', 'name'>]>,
    { mode: 'output'; projections: [ColumnProjectionIR<null, 'name', 'name'>] }
  >
>;
type NoOutputContract = Expect<Equal<OutputIR, { mode: 'none'; projections: [] }>>;
type ResolveTargetContract = Expect<
  Equal<TargetSource['kind'], 'ok'>
>;
type ResolveColumnContract = Expect<
  Equal<ResolveWriteColumn<DB, Target, 'name'>, { kind: 'ok'; value: string }>
>;
type UnknownColumnContract = Expect<
  Equal<ResolveWriteColumn<DB, Target, 'nope'>['kind'], 'error'>
>;
type ReturningInference = Expect<
  Equal<
    ApplyLoosePolicy<
      InferOutput<
        DB,
        TargetScope,
        OutputIR<'returning', [ColumnProjectionIR<null, 'id', 'id'>]>
      >
    >,
    { id: number }[]
  >
>;
type NoOutputInference = Expect<
  Equal<
    ApplyLoosePolicy<InferOutput<DB, TargetScope, OutputIR>>,
    Record<string, never>[]
  >
>;

type InsertParity<Sql extends string> = Equal<
  LegacyInferResult<DB, Sql>,
  NextInsertQuery<DB, Sql>
>;

type StrictInsertParity<Sql extends string> = Equal<
  LegacyInferResultStrict<DB, Sql>,
  NextInsertStrictQuery<DB, Sql>
>;

type InsertParamsParity<Sql extends string> = Equal<
  LegacyInferParams<DB, Sql>,
  NextInsertInferParams<DB, Sql>
>;

type ValuesReturning = Expect<InsertParity<
  'insert into users (name) values ($1) returning id, name'
>>;
type ValuesWithoutOutput = Expect<InsertParity<
  'insert into users (name) values ($1)'
>>;
type OutputBeforeValues = Expect<InsertParity<
  'insert into users (name) output inserted.id values (@name)'
>>;
type GluedColumns = Expect<StrictInsertParity<
  'insert into users(id, name) values ($1, $2) returning id'
>>;
type TargetAlias = Expect<StrictInsertParity<
  'insert into users as u (name) values ($1) returning u.id'
>>;
type SchemaQualifiedTarget = Expect<InsertParity<
  'insert into public.users (name) values ($1) returning id'
>>;
type QuotedTarget = Expect<InsertParity<
  'insert into "public"."users" (name) values ($1) returning id'
>>;
type UnknownTarget = Expect<StrictInsertParity<
  'insert into ghosts (name) values ($1)'
>>;
type UnknownColumn = Expect<StrictInsertParity<
  'insert into users (naem) values ($1)'
>>;
type UnknownLaterColumn = Expect<StrictInsertParity<
  'insert into users (id, name, nope) values ($1, $2, $3)'
>>;
type InsertSelect = Expect<StrictInsertParity<
  'insert into users (name) select name from users'
>>;
type InsertSelectUnknownColumn = Expect<StrictInsertParity<
  'insert into users (name) select nope from users'
>>;
type InsertSelectUnknownTable = Expect<StrictInsertParity<
  'insert into users (name) select name from ghosts'
>>;
type InsertSelectUnknownPredicate = Expect<StrictInsertParity<
  'insert into users (name) select name from users where nope = 1'
>>;
type PositionalParams = Expect<InsertParamsParity<
  'insert into users (id, name) values (?, ?)'
>>;
type MultipleRows = Expect<InsertParamsParity<
  'insert into users (id, name) values ($1, $2), ($3, $4)'
>>;
type MixedLiterals = Expect<InsertParamsParity<
  "insert into users (id, name) values (1, $1), (2, $2)"
>>;
type CallParams = Expect<InsertParamsParity<
  'insert into users (id, name) values (coalesce($1, 0), lower($2))'
>>;
type ConflictParams = Expect<InsertParamsParity<
  'insert into users (name) values ($1) on conflict (name) do update set name = $2'
>>;
type InsertSelectParams = Expect<InsertParamsParity<
  'insert into users (id, name) select id, name from users where id = $1'
>>;
type NullableParams = Expect<InsertParamsParity<
  'insert into users (name, email) values ($1, $2)'
>>;
type NamedCallParams = Expect<InsertParamsParity<
  'insert into users (id, name) values (coalesce(@id, 0), @name)'
>>;
type NestedCallParams = Expect<InsertParamsParity<
  'insert into users (id, name) values ($1, coalesce(lower(@name), $$x$$))'
>>;
type NoColumnListParams = Expect<InsertParamsParity<
  'insert into users values ($1, $2, $3)'
>>;
type DefaultValues = Expect<InsertParity<
  'insert into users default values returning id'
>>;
type InsertSelectReturning = Expect<StrictInsertParity<
  'insert into users (id, name) select id, name from users returning id'
>>;
type UnknownReturningColumn = Expect<StrictInsertParity<
  'insert into users (name) values ($1) returning nope'
>>;
type LooseUnknownColumn = Expect<InsertParity<
  'insert into users (nope) values ($1)'
>>;
type UppercaseInsert = Expect<InsertParity<
  'INSERT INTO users (name) VALUES ($1) RETURNING id'
>>;

export type InsertContractLock = [
  TargetContract,
  InsertColumnsContract,
  AssignmentContract,
  ReturningContract,
  OutputContract,
  NoOutputContract,
  ResolveTargetContract,
  ResolveColumnContract,
  UnknownColumnContract,
  ReturningInference,
  NoOutputInference,
  ValuesReturning,
  ValuesWithoutOutput,
  OutputBeforeValues,
  GluedColumns,
  TargetAlias,
  SchemaQualifiedTarget,
  QuotedTarget,
  UnknownTarget,
  UnknownColumn,
  UnknownLaterColumn,
  InsertSelect,
  InsertSelectUnknownColumn,
  InsertSelectUnknownTable,
  InsertSelectUnknownPredicate,
  PositionalParams,
  MultipleRows,
  MixedLiterals,
  CallParams,
  ConflictParams,
  InsertSelectParams,
  NullableParams,
  NamedCallParams,
  NestedCallParams,
  NoColumnListParams,
  DefaultValues,
  InsertSelectReturning,
  UnknownReturningColumn,
  LooseUnknownColumn,
  UppercaseInsert,
];
