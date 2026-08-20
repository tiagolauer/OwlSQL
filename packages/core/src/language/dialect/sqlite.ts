import type { DialectCapabilities } from './common.js';

export interface SqliteCapabilities extends DialectCapabilities {
  top: false;
  distinctOn: false;
  returning: true;
  output: false;
  placeholder: 'mixed';
  quote: 'mixed';
}
