import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  generateSchema,
  type Introspector,
} from '../../src/tooling/schema-generator/generate.js';

const directories: string[] = [];

afterEach(() => {
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

function outputFile(): string {
  const directory = mkdtempSync(join(tmpdir(), 'owlsql-tooling-'));
  directories.push(directory);
  return join(directory, 'schema.ts');
}

const introspector: Introspector = {
  async introspect() {
    return [
      { name: 'users', columns: [{ name: 'id', tsType: 'number', nullable: false }] },
      { name: 'posts', columns: [{ name: 'title', tsType: 'string', nullable: true }] },
    ];
  },
};

describe('generateSchema', () => {
  it('writes generated TypeScript and reports check state', async () => {
    const out = outputFile();
    const options = { url: 'postgres://example/db', out, dialect: 'postgres' as const };

    await expect(generateSchema(options, introspector)).resolves.toEqual({ kind: 'written' });
    expect(readFileSync(out, 'utf8')).toBe(
      'export interface DB {\n  users: {\n    id: number;\n  };\n  posts: {\n    title: string | null;\n  };\n}\n',
    );
    await expect(generateSchema({ ...options, check: true }, introspector)).resolves.toEqual({
      kind: 'upToDate',
    });

    writeFileSync(out, 'stale\n', 'utf8');
    await expect(generateSchema({ ...options, check: true }, introspector)).resolves.toMatchObject({
      kind: 'drift',
      summary: expect.stringContaining('first differs at line 1'),
    });
  });

  it('validates include names and warns for unmatched excludes', async () => {
    const out = outputFile();

    await expect(
      generateSchema(
        { url: 'postgres://example/db', out, tables: ['missing'] },
        introspector,
      ),
    ).rejects.toThrow('--table matched no such table: missing');

    await expect(
      generateSchema(
        { url: 'postgres://example/db', out, tables: ['users'], exclude: ['missing'] },
        introspector,
      ),
    ).resolves.toEqual({
      kind: 'written',
      warnings: ['--exclude matched no such table: missing'],
    });
    expect(readFileSync(out, 'utf8')).not.toContain('posts');
  });
});
