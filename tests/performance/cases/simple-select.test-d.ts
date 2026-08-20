import type { Query } from '../../../packages/core/src/index.js';
import type { DB } from '../generated/schema.js';

export declare const simpleSelect: Query<DB, 'select id, name, email from t_000'>;
