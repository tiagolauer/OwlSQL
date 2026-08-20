import type { Query } from '../../../packages/core/src/index.js';
import type { DB } from '../generated/schema.js';

export declare const correlatedSubquery: Query<
  DB,
  'select outer_table.id, (select max(inner_table.amount) from t_001 inner_table where inner_table.id = outer_table.id and inner_table.amount > (select avg(deep_table.amount) from t_002 deep_table where deep_table.id = inner_table.id)) as score from t_000 outer_table'
>;
