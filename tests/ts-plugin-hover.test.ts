import { describe, it, expect, afterEach } from 'vitest';
import { rmSync } from 'node:fs';
import ts from 'typescript';
import detectModule from '../src/ts-plugin/detect.cts';
import schemaModule from '../src/ts-plugin/schema.cts';
import sqlContext from '../src/ts-plugin/sql-context.cts';
import { buildProgram } from './ts-plugin-test-helpers.js';

const { matchQueryLiteral } = detectModule;
const { getColumnType } = schemaModule;
const { findFromTable, getWordAtOffset } = sqlContext;

const FIXTURE = `
import type { TypedDb } from '@owlsql/core';

interface DB {
  users: { id: number; name: string; email: string | null };
  posts: { id: number; title: string };
}

declare const db: TypedDb<DB>;

db.query(\`select id, name from users\`);
db.query(\`select id from posts\`);
`;

describe('getWordAtOffset', () => {
  it('finds the word the cursor sits inside', () => {
    expect(getWordAtOffset('select id, name from users', 8)).toEqual({ word: 'id', start: 7, end: 9 });
  });

  it('finds the word when the cursor sits at its trailing edge', () => {
    expect(getWordAtOffset('select id, name from users', 9)).toEqual({ word: 'id', start: 7, end: 9 });
  });

  it('returns null for a position that is not inside a word', () => {
    expect(getWordAtOffset('select id,  name from users', 10)).toBeNull();
  });

  it('returns null for an out-of-range offset', () => {
    expect(getWordAtOffset('select id', -1)).toBeNull();
    expect(getWordAtOffset('select id', 100)).toBeNull();
  });
});

describe('ts-plugin hover: getColumnType against a real ts.Program', () => {
  let cleanupDir: string | null = null;

  afterEach(() => {
    if (cleanupDir) {
      rmSync(cleanupDir, { recursive: true, force: true });
      cleanupDir = null;
    }
  });

  it('resolves the type of a column scoped to its FROM table', () => {
    const { program, sourceFile, dir } = buildProgram(FIXTURE, 'owlsql-ts-plugin-hover-');
    cleanupDir = dir;
    const checker = program.getTypeChecker();

    const literalText = 'select id, name from users';
    const literalStart = sourceFile.text.indexOf(`\`${literalText}\``) + 1;
    const cursor = sourceFile.text.indexOf('name', literalStart) + 1;
    const match = matchQueryLiteral(ts, checker, sourceFile, cursor);
    expect(match).not.toBeNull();
    if (!match) return;

    const word = getWordAtOffset(match.literal.text, cursor - literalStart);
    expect(word?.word).toBe('name');
    if (!word) return;

    const table = findFromTable(match.literal.text);
    expect(table).toBe('users');

    const columnType = getColumnType(checker, match.dbType, match.literal, table, word.word);
    expect(columnType && checker.typeToString(columnType)).toBe('string');
  });

  it('resolves a nullable column type', () => {
    const { program, sourceFile, dir } = buildProgram(FIXTURE, 'owlsql-ts-plugin-hover-');
    cleanupDir = dir;
    const checker = program.getTypeChecker();

    const literalText = 'select id, name from users';
    const literalStart = sourceFile.text.indexOf(`\`${literalText}\``) + 1;
    const cursor = literalStart + literalText.indexOf('users') + 1;
    const match = matchQueryLiteral(ts, checker, sourceFile, cursor);
    expect(match).not.toBeNull();
    if (!match) return;

    const table = findFromTable(match.literal.text);
    const columnType = getColumnType(checker, match.dbType, match.literal, table, 'email');
    expect(columnType && checker.typeToString(columnType)).toBe('string | null');
  });

  it('returns null for a word that is not a real column', () => {
    const { program, sourceFile, dir } = buildProgram(FIXTURE, 'owlsql-ts-plugin-hover-');
    cleanupDir = dir;
    const checker = program.getTypeChecker();

    const literalText = 'select id from posts';
    const literalStart = sourceFile.text.indexOf(`\`${literalText}\``) + 1;
    const cursor = literalStart + 1;
    const match = matchQueryLiteral(ts, checker, sourceFile, cursor);
    expect(match).not.toBeNull();
    if (!match) return;

    const table = findFromTable(match.literal.text);
    const columnType = getColumnType(checker, match.dbType, match.literal, table, 'nope');
    expect(columnType).toBeNull();
  });
});
