import type { DialectCapabilities } from './common.js';

export interface PostgresCapabilities extends DialectCapabilities {
  top: false;
  distinctOn: true;
  returning: true;
  output: false;
  placeholder: 'dollar';
  quote: 'double';
}
