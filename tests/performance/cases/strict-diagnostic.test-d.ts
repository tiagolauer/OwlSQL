import type { QueryTypeError, StrictQuery } from '../../../packages/core/src/index.js';
import type { DB } from '../generated/schema.js';

export declare const strictDiagnostic: StrictQuery<DB, 'select missing from t_000'> extends QueryTypeError<'unknown column: missing'>[]
  ? true
  : false;
