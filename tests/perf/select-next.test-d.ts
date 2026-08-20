import type {
  NextQuery,
} from '../../src/compiler/next/index.js';
import type { DB } from './generated/schema.js';

export declare const simple: NextQuery<
  DB,
  'select id, name, email, created_at from t_000'
>;
