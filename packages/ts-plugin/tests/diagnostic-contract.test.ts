import { afterAll, describe, expect, it } from 'vitest';
import { rmSync } from 'node:fs';
import ts from 'typescript';
import type { PluginDiagnostic } from '../src/analysis-contract.cts';
import { loadDiagnostics } from './test-helpers.js';

const { diagnostics, dir } = loadDiagnostics();

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('editor diagnostic mapping', () => {
  it.each([
    ['UNKNOWN_COLUMN', 990002, 'unknown column: nope', 'nope'],
    ['UNKNOWN_ALIAS', 990003, 'unknown alias: z', 'z'],
    ['AMBIGUOUS_COLUMN', 990004, 'ambiguous column: id', 'id'],
    ['PARAM_TYPE_CONFLICT', 990005, 'parameter type conflict: $1', '$1'],
    ['UNSUPPORTED_STATEMENT', 990007, 'unsupported statement: vacuum', 'vacuum'],
  ] as const)('maps %s to a stable TypeScript diagnostic', (code, expectedCode, message, reference) => {
    const sourceFile = ts.createSourceFile('fixture.ts', reference, ts.ScriptTarget.ES2022);
    const diagnostic: PluginDiagnostic = {
      code,
      message,
      location: code === 'PARAM_TYPE_CONFLICT' ? 'parameter' : 'statement',
      reference,
      start: 0,
      length: reference.length,
    };

    expect(diagnostics.toEditorDiagnostic(ts, sourceFile, diagnostic)).toMatchObject({
      file: sourceFile,
      start: 0,
      length: reference.length,
      messageText: message,
      category: ts.DiagnosticCategory.Warning,
      code: expectedCode,
      source: 'owlsql',
    });
  });
});
