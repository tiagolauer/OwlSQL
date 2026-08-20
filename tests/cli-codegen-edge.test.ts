import { describe, expect, it } from 'vitest';
import ts from 'typescript';
import { renderSchema } from '../src/tooling/schema-generator/codegen.js';
import { mapPostgresType } from '../src/tooling/introspection/postgres.js';

function parseErrorCount(source: string): number {
  const sourceFile = ts.createSourceFile('schema.ts', source, ts.ScriptTarget.Latest, true);
  return (sourceFile as unknown as { parseDiagnostics: readonly unknown[] }).parseDiagnostics.length;
}

describe('renderSchema edge cases', () => {
  it('quotes names that are not valid identifiers, including quotes and backslashes', () => {
    const rendered = renderSchema([
      {
        name: 'weird table',
        columns: [
          { name: 'col"name', tsType: 'string', nullable: false },
          { name: 'back\\slash', tsType: 'number', nullable: true },
          { name: 'plain', tsType: 'boolean', nullable: false },
        ],
      },
    ]);

    expect(rendered).toBe(
      'export interface DB {\n' +
        '  "weird table": {\n' +
        '    "col\\"name": string;\n' +
        '    "back\\\\slash": number | null;\n' +
        '    plain: boolean;\n' +
        '  };\n' +
        '}\n',
    );
  });

  it('renders a parseable module for an enum label ending in a backslash (issue #201 repro)', () => {
    const enums = new Map([['mood', ['a\\', 'b']]]);
    const rendered = renderSchema([
      {
        name: 'items',
        columns: [{ name: 'kind', tsType: mapPostgresType('mood', enums), nullable: false }],
      },
    ]);

    expect(parseErrorCount(rendered)).toBe(0);
  });

  it('renders a zero-column table as an empty object', () => {
    const rendered = renderSchema([{ name: 'empty_t', columns: [] }]);

    expect(rendered).toBe('export interface DB {\n  empty_t: {\n\n  };\n}\n');
  });
});
