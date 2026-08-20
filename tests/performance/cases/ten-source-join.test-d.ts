import type { Query } from '../../../packages/core/src/index.js';
import type { DB } from '../generated/schema.js';

export declare const tenSourceJoin: Query<
  DB,
  'select a0.id, a9.name from t_000 a0 join t_001 a1 on a1.id = a0.id join t_002 a2 on a2.id = a1.id join t_003 a3 on a3.id = a2.id join t_004 a4 on a4.id = a3.id join t_005 a5 on a5.id = a4.id join t_006 a6 on a6.id = a5.id join t_007 a7 on a7.id = a6.id join t_008 a8 on a8.id = a7.id join t_009 a9 on a9.id = a8.id'
>;
