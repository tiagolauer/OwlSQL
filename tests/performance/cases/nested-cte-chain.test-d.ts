import type { Query } from '../../../packages/core/src/index.js';
import type { DB } from '../generated/schema.js';

export declare const nestedCteChain: Query<
  DB,
  'with c0 as (select id, name from t_000), c1 as (select id, name from c0), c2 as (select id, name from c1), c3 as (select id, name from c2), c4 as (select id, name from c3), c5 as (select id, name from c4), c6 as (select id, name from c5), c7 as (select id, name from c6), c8 as (select id, name from c7), c9 as (select id, name from c8) select id, name from c9'
>;
