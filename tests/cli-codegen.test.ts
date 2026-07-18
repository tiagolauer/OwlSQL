import { describe, it, expect } from 'vitest';
import { renderSchema } from '../src/cli/codegen';
import type { TableSchema } from '../src/cli/types';

describe('renderSchema', () => {
  it('renders multiple tables with their columns', () => {
    const tables: TableSchema[] = [
      {
        name: 'users',
        columns: [
          { name: 'id', tsType: 'number', nullable: false },
          { name: 'name', tsType: 'string', nullable: false },
        ],
      },
      {
        name: 'posts',
        columns: [{ name: 'id', tsType: 'number', nullable: false }],
      },
    ];

    expect(renderSchema(tables)).toBe(
      'export interface DB {\n' +
        '  users: {\n' +
        '    id: number;\n' +
        '    name: string;\n' +
        '  };\n' +
        '  posts: {\n' +
        '    id: number;\n' +
        '  };\n' +
        '}\n',
    );
  });

  it('appends | null for nullable columns', () => {
    const tables: TableSchema[] = [
      {
        name: 'users',
        columns: [{ name: 'bio', tsType: 'string', nullable: true }],
      },
    ];

    expect(renderSchema(tables)).toContain('bio: string | null;');
  });

  it('quotes column and table names that are not valid identifiers', () => {
    const tables: TableSchema[] = [
      {
        name: 'user-accounts',
        columns: [{ name: 'display name', tsType: 'string', nullable: false }],
      },
    ];

    const result = renderSchema(tables);

    expect(result).toContain('"user-accounts": {');
    expect(result).toContain('"display name": string;');
  });

  it('does not quote reserved-word-like identifiers that are still valid property names', () => {
    const tables: TableSchema[] = [
      {
        name: 'order',
        columns: [{ name: 'class', tsType: 'string', nullable: false }],
      },
    ];

    const result = renderSchema(tables);

    expect(result).toContain('order: {');
    expect(result).toContain('class: string;');
  });
});
