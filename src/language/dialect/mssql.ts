import type { DialectCapabilities } from './common.js';

export interface MssqlCapabilities extends DialectCapabilities {
  top: true;
  distinctOn: false;
  returning: false;
  output: true;
  placeholder: 'at';
  quote: 'bracket';
}
