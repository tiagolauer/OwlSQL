import type { DialectCapabilities } from './common.js';

export interface MysqlCapabilities extends DialectCapabilities {
  top: false;
  distinctOn: false;
  returning: false;
  output: false;
  placeholder: 'question';
  quote: 'backtick';
}
