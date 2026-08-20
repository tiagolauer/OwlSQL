import type { FirstWord, IsKeyword, Normalize } from '../../string.js';

export type StatementKind =
  | 'select'
  | 'with'
  | 'insert'
  | 'update'
  | 'delete'
  | 'merge'
  | 'unknown';

type KindOf<Token extends string> =
  IsKeyword<Token, 'select'> extends true ? 'select'
  : IsKeyword<Token, 'with'> extends true ? 'with'
  : IsKeyword<Token, 'insert'> extends true ? 'insert'
  : IsKeyword<Token, 'update'> extends true ? 'update'
  : IsKeyword<Token, 'delete'> extends true ? 'delete'
  : IsKeyword<Token, 'merge'> extends true ? 'merge'
  : 'unknown';

export type ClassifyStatement<Sql extends string> = KindOf<FirstWord<Normalize<Sql>>>;
