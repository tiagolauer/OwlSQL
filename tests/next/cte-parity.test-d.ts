import type {
  LegacyInferParams,
  LegacyInferResult,
  LegacyInferResultStrict,
} from '../../src/compiler/legacy.js';
import type {
  InferParamsViaGateway,
  InferViaGateway,
} from '../../src/compiler/gateway.js';
import type {
  NextWithInferParams,
  NextWithQuery,
  NextWithStrictQuery,
} from '../../src/compiler/next/index.js';
import type { ParseWithIR } from '../../src/language/with/parse-with.js';

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends
  (<T>() => T extends B ? 1 : 2) ? true : false;

type Expect<Value extends true> = Value;

type DB = {
  users: { id: number; name: string; active: boolean };
  posts: { id: number; user_id: number; title: string; views: number };
};

type _structural = Expect<
  ParseWithIR<'with recursive popular(post_id) as materialized (select id from posts) select post_id from popular'> extends {
    kind: 'ok';
    value: {
      ctes: readonly [{
        name: 'popular';
        columns: readonly ['post_id'];
        query: { kind: 'select' };
        recursive: true;
      }];
      query: { kind: 'select' };
    };
  }
    ? true
    : false
>;

type _single = Expect<Equal<
  LegacyInferResult<DB, 'with popular as (select id, title from posts where views > 100) select id, title from popular'>,
  NextWithQuery<DB, 'with popular as (select id, title from posts where views > 100) select id, title from popular'>
>>;

type _chained = Expect<Equal<
  LegacyInferResult<DB, 'with popular as (select id, title from posts), titles as (select title from popular) select title from titles'>,
  NextWithQuery<DB, 'with popular as (select id, title from posts), titles as (select title from popular) select title from titles'>
>>;


type _aliases = Expect<Equal<
  LegacyInferResult<DB, 'with popular(post_id, label) as (select id, title from posts) select post_id, label from popular'>,
  NextWithQuery<DB, 'with popular(post_id, label) as (select id, title from posts) select post_id, label from popular'>
>>;

type _shadowing = Expect<Equal<
  LegacyInferResultStrict<DB, 'with users as (select id from posts) select name from users'>,
  NextWithStrictQuery<DB, 'with users as (select id from posts) select name from users'>
>>;

type _params = Expect<Equal<
  LegacyInferParams<DB, 'with popular as (select id from posts where views > @minimum) select id from popular where id = @id'>,
  NextWithInferParams<DB, 'with popular as (select id from posts where views > @minimum) select id from popular where id = @id'>
>>;

type _nestedCase = Expect<Equal<
  LegacyInferResult<DB, "with states as (select case when active then case when name = 'x' then 'named' else 'active' end else 'inactive' end as state from users) select state from states">,
  NextWithQuery<DB, "with states as (select case when active then case when name = 'x' then 'named' else 'active' end else 'inactive' end as state from users) select state from states">
>>;

type _materialized = Expect<Equal<
  LegacyInferResult<DB, 'with popular as materialized (select id from posts) select id from popular'>,
  NextWithQuery<DB, 'with popular as materialized (select id from posts) select id from popular'>
>>;

type _notMaterialized = Expect<Equal<
  LegacyInferResult<DB, 'with popular as not materialized (select id from posts) select id from popular'>,
  NextWithQuery<DB, 'with popular as not materialized (select id from posts) select id from popular'>
>>;

type _recursiveKeyword = Expect<Equal<
  LegacyInferResult<DB, 'with recursive popular as (select id from posts) select id from popular'>,
  NextWithQuery<DB, 'with recursive popular as (select id from posts) select id from popular'>
>>;

type _diagnosticPropagation = Expect<Equal<
  LegacyInferResultStrict<DB, 'with broken as (select missing from posts) select missing from broken'>,
  NextWithStrictQuery<DB, 'with broken as (select missing from posts) select missing from broken'>
>>;

type _scalarSubqueryScope = Expect<Equal<
  LegacyInferResult<DB, 'with popular as (select id from posts) select (select id from popular) as post_id'>,
  NextWithQuery<DB, 'with popular as (select id from posts) select (select id from popular) as post_id'>
>>;

type WithLedUpdate = `with targets as (select id from users)
update users set name = @name where id in (select id from targets)`;

type _withLedDmlResultStaysLegacy = Expect<Equal<
  InferViaGateway<DB, WithLedUpdate>,
  LegacyInferResult<DB, WithLedUpdate>
>>;

type _withLedDmlParamsStayLegacy = Expect<Equal<
  InferParamsViaGateway<DB, WithLedUpdate>,
  LegacyInferParams<DB, WithLedUpdate>
>>;
