import type { Query } from '../../../packages/core/src/index.js';
import type { DB } from '../generated/schema.js';

export declare const insertReturning: Query<
  DB,
  'insert into t_000 (name) values ($1) returning id, name'
>;

export declare const updateReturning: Query<
  DB,
  'update t_000 set name = $1 where id = $2 returning id, name'
>;

export declare const deleteReturning: Query<
  DB,
  'delete from t_000 where id = $1 returning id'
>;

export declare const mergeOutput: Query<
  DB,
  'merge into t_000 as target using (values (@id, @name)) as source (id, name) on target.id = source.id when matched then update set target.name = source.name when not matched then insert (id, name) values (source.id, source.name) output inserted.id, inserted.name'
>;
