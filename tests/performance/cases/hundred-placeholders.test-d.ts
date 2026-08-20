import type { Params } from '../../../packages/core/src/index.js';
import type { DB } from '../generated/schema.js';

export declare const firstTwentyFivePlaceholders: Params<
  DB,
  'select id from t_000 where id in ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25)'
>;

export declare const secondTwentyFivePlaceholders: Params<
  DB,
  'select id from t_001 where id in ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25)'
>;

export declare const thirdTwentyFivePlaceholders: Params<
  DB,
  'select id from t_002 where id in ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25)'
>;

export declare const fourthTwentyFivePlaceholders: Params<
  DB,
  'select id from t_003 where id in ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25)'
>;
