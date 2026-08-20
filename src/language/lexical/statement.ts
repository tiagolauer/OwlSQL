import type { FirstWord, IsKeyword, Normalize, Trim } from './string.js';

type StatementKindName =
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

export type StatementKind<Sql extends string> = KindOf<FirstWord<Trim<Sql>>> extends infer Direct extends StatementKindName
  ? Direct extends 'unknown'
    ? KindOf<FirstWord<Normalize<Sql>>>
    : Direct
  : never;

export type ClassifyStatement<Sql extends string> = StatementKind<Sql>;
