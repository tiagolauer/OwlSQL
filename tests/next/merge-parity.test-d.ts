import type {
  LegacyInferParams,
  LegacyInferResult,
  LegacyInferResultStrict,
} from '../../src/compiler/legacy.js';
import type {
  NextMergeInferParams,
  NextMergeQuery,
  NextMergeStrictQuery,
} from '../../src/compiler/next/index.js';

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends
  (<T>() => T extends B ? 1 : 2) ? true : false;

type Expect<T extends true> = T;

type DB = {
  users: {
    id: number;
    name: string;
    email: string;
  };
};

type Parity<Sql extends string> = Equal<
  LegacyInferResult<DB, Sql>,
  NextMergeQuery<DB, Sql>
>;

type StrictParity<Sql extends string> = Equal<
  LegacyInferResultStrict<DB, Sql>,
  NextMergeStrictQuery<DB, Sql>
>;

type ParamsParity<Sql extends string> = Equal<
  LegacyInferParams<DB, Sql>,
  NextMergeInferParams<DB, Sql>
>;

type FullMerge =
  'merge into users as target using (values (@id, @name)) as source (id, name) on target.id = source.id when matched then update set target.name = source.name when not matched then insert (id, name) values (source.id, source.name) output inserted.id, inserted.name';

type ActionMerge =
  'merge into users as target using (values (@id, @name)) as source (id, name) on target.id = source.id when matched then update set target.name = source.name output $action, inserted.id';

type NoAliasMerge =
  'merge into users using (values (@id)) as source (id) on users.id = source.id when not matched then insert (id) values (source.id) output inserted.id';

type NoOutputMerge =
  'merge into users as target using (values (@id, @name)) as source (id, name) on target.id = source.id when matched then update set target.name = source.name';

type Output = Expect<Parity<FullMerge>>;
type ActionOutput = Expect<Parity<ActionMerge>>;
type ActionParams = Expect<ParamsParity<ActionMerge>>;
type WithoutAlias = Expect<Parity<NoAliasMerge>>;
type WithoutOutput = Expect<Parity<NoOutputMerge>>;
type UnknownOutput = Expect<StrictParity<
  'merge into users as target using (values (@id)) as source (id) on target.id = source.id when not matched then insert (id) values (source.id) output inserted.bogus'
>>;
type UnknownTarget = Expect<StrictParity<
  'merge into ghosts as target using (values (@id)) as source (id) on target.id = source.id when not matched then insert (id) values (source.id) output inserted.id'
>>;
type Uppercase = Expect<Parity<
  'MERGE INTO users AS target USING (values (@id, @name)) AS source (id, name) ON target.id = source.id WHEN MATCHED THEN UPDATE SET target.name = source.name OUTPUT inserted.id'
>>;
type UnknownActionColumn = Expect<StrictParity<
  'merge into users as target using (values (@id)) as source (id) on target.id = source.id when matched then update set target.nope = source.id output inserted.id'
>>;
type InsertActionColumn = Expect<StrictParity<
  'merge into users as target using (values (@id)) as source (id) on target.id = source.id when not matched then insert (nope) values (source.id) output inserted.id'
>>;
type ActionPlaceholder = Expect<ParamsParity<
  'merge into users as target using (values (@id)) as source (id) on target.id = source.id when matched then update set target.name = @name output inserted.id'
>>;
type InsertPlaceholder = Expect<ParamsParity<
  'merge into users as target using (values (@source_id)) as source (id) on target.id = source.id when not matched then insert (id, name) values (@id, @name) output inserted.id'
>>;

export type MergeParityLock = [
  Output,
  ActionOutput,
  ActionParams,
  WithoutAlias,
  WithoutOutput,
  UnknownOutput,
  UnknownTarget,
  Uppercase,
  UnknownActionColumn,
  InsertActionColumn,
  ActionPlaceholder,
  InsertPlaceholder,
];
