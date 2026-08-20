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

  it('reports tooling imports from compiler implementation internals', () => {
    const root = mkdtempSync(join(tmpdir(), 'owlsql-architecture-'));
    mkdirSync(join(root, 'src', 'tooling'), { recursive: true });
    mkdirSync(join(root, 'src', 'compiler', 'next'), { recursive: true });
    writeFileSync(join(root, 'src', 'compiler', 'next', 'index.ts'), 'export type Next = string;\n');
    writeFileSync(
      join(root, 'src', 'tooling', 'invalid.ts'),
      "import type { Next } from '../compiler/next/index.js';\n",
    );

    try {
      expect(checkArchitecture(root)).toEqual([
        'src/tooling/invalid.ts -> src/compiler/next/index.ts violates tooling isolation',
      ]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('reports editor plugin imports outside the analysis bridge', () => {
    const root = mkdtempSync(join(tmpdir(), 'owlsql-architecture-'));
    mkdirSync(join(root, 'src', 'compiler', 'next'), { recursive: true });
    mkdirSync(join(root, 'ts-plugin', 'src'), { recursive: true });
    writeFileSync(join(root, 'src', 'compiler', 'next', 'index.ts'), 'export type Next = string;\n');
    writeFileSync(
      join(root, 'ts-plugin', 'src', 'invalid.cts'),
      "import type { Next } from '../../src/compiler/next/index.js';\n",
    );

    try {
      expect(checkArchitecture(root)).toEqual([
        'ts-plugin/src/invalid.cts -> src/compiler/next/index.ts violates editor plugin contract',
      ]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
