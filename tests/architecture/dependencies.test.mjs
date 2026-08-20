import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkArchitecture } from '../../scripts/check-architecture.mjs';

describe('architecture dependencies', () => {
  it('has no forbidden imports', () => {
    expect(checkArchitecture(process.cwd())).toEqual([]);
  });

  it('reports runtime imports from legacy compiler files', () => {
    const root = mkdtempSync(join(tmpdir(), 'owlsql-architecture-'));
    mkdirSync(join(root, 'src', 'runtime'), { recursive: true });
    writeFileSync(join(root, 'src', 'parse.ts'), 'export type Parsed = string;\n');
    writeFileSync(
      join(root, 'src', 'runtime', 'invalid.ts'),
      "import type { Parsed } from '../parse.js';\n",
    );

    try {
      expect(checkArchitecture(root)).toEqual([
        'src/runtime/invalid.ts -> src/parse.ts violates runtime isolation',
      ]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
