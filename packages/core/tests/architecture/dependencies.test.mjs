import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { checkArchitecture } from '../../../../scripts/check-architecture.mjs';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');

describe('architecture dependencies', () => {
  it('has no forbidden imports', () => {
    expect(checkArchitecture(REPO_ROOT)).toEqual([]);
  });

  it('reports runtime imports from compiler files', () => {
    const root = mkdtempSync(join(tmpdir(), 'owlsql-architecture-'));
    mkdirSync(join(root, 'packages', 'core', 'src', 'runtime'), { recursive: true });
    mkdirSync(join(root, 'packages', 'core', 'src', 'compiler'), { recursive: true });
    writeFileSync(join(root, 'packages', 'core', 'src', 'compiler', 'gateway.ts'), 'export type Query = string;\n');
    writeFileSync(
      join(root, 'packages', 'core', 'src', 'runtime', 'invalid.ts'),
      "import type { Query } from '../compiler/gateway.js';\n",
    );

    try {
      expect(checkArchitecture(root)).toEqual([
        'packages/core/src/runtime/invalid.ts -> packages/core/src/compiler/gateway.ts violates runtime isolation',
      ]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('reports tooling imports from compiler implementation internals', () => {
    const root = mkdtempSync(join(tmpdir(), 'owlsql-architecture-'));
    mkdirSync(join(root, 'packages', 'core', 'src', 'tooling'), { recursive: true });
    mkdirSync(join(root, 'packages', 'core', 'src', 'compiler', 'next'), { recursive: true });
    writeFileSync(join(root, 'packages', 'core', 'src', 'compiler', 'next', 'index.ts'), 'export type Next = string;\n');
    writeFileSync(
      join(root, 'packages', 'core', 'src', 'tooling', 'invalid.ts'),
      "import type { Next } from '../compiler/next/index.js';\n",
    );

    try {
      expect(checkArchitecture(root)).toEqual([
        'packages/core/src/tooling/invalid.ts -> packages/core/src/compiler/next/index.ts violates tooling isolation',
      ]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('reports adapter imports from compiler internals', () => {
    const root = mkdtempSync(join(tmpdir(), 'owlsql-architecture-'));
    mkdirSync(join(root, 'packages', 'core', 'src', 'adapters'), { recursive: true });
    mkdirSync(join(root, 'packages', 'core', 'src', 'compiler'), { recursive: true });
    writeFileSync(join(root, 'packages', 'core', 'src', 'compiler', 'gateway.ts'), 'export type Query = string;\n');
    writeFileSync(
      join(root, 'packages', 'core', 'src', 'adapters', 'invalid.ts'),
      "import type { Query } from '../compiler/gateway.js';\n",
    );

    try {
      expect(checkArchitecture(root)).toEqual([
        'packages/core/src/adapters/invalid.ts -> packages/core/src/compiler/gateway.ts violates adapter isolation',
      ]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('reports editor plugin imports outside the analysis bridge', () => {
    const root = mkdtempSync(join(tmpdir(), 'owlsql-architecture-'));
    mkdirSync(join(root, 'packages', 'core', 'src', 'compiler', 'next'), { recursive: true });
    mkdirSync(join(root, 'packages', 'ts-plugin', 'src'), { recursive: true });
    writeFileSync(join(root, 'packages', 'core', 'src', 'compiler', 'next', 'index.ts'), 'export type Next = string;\n');
    writeFileSync(
      join(root, 'packages', 'ts-plugin', 'src', 'invalid.cts'),
      "import type { Next } from '../../core/src/compiler/next/index.js';\n",
    );

    try {
      expect(checkArchitecture(root)).toEqual([
        'packages/ts-plugin/src/invalid.cts -> packages/core/src/compiler/next/index.ts violates editor plugin contract',
      ]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
