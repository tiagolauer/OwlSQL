import ts from 'typescript';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');

export interface BuiltProgram {
  program: ts.Program;
  sourceFile: ts.SourceFile;
  filePath: string;
  dir: string;
}

export function buildProgram(source: string, fixturePrefix: string): BuiltProgram {
  const dir = mkdtempSync(join(tmpdir(), fixturePrefix));
  const filePath = join(dir, 'fixture.ts');
  writeFileSync(filePath, source, 'utf8');

  const program = ts.createProgram([filePath], {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    strict: true,
    baseUrl: REPO_ROOT,
    paths: { '@owlsql/core': ['src/index.ts'] },
  });

  const sourceFile = program.getSourceFile(filePath);
  if (!sourceFile) {
    throw new Error('fixture source file was not found in the program');
  }

  return { program, sourceFile, filePath, dir };
}
