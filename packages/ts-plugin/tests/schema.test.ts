import { describe, it, expect, afterEach } from 'vitest';
import { rmSync } from 'node:fs';
import ts from 'typescript';
import schemaModule from '../src/schema.cts';
import { buildProgram } from './test-helpers.js';

const { getColumnNames, getColumnType } = schemaModule;

describe('getColumnNames / getColumnType scoping', () => {
  let cleanupDir: string | null = null;

  afterEach(() => {
    if (cleanupDir) {
      rmSync(cleanupDir, { recursive: true, force: true });
      cleanupDir = null;
    }
  });

  function buildDbType(source: string): { checker: ts.TypeChecker; dbType: ts.Type; node: ts.Node } {
    const { program, sourceFile, dir } = buildProgram(`${source}\ndbValue;\n`, 'owlsql-ts-plugin-schema-');
    cleanupDir = dir;
    const checker = program.getTypeChecker();

    const lastStatement = sourceFile.statements[sourceFile.statements.length - 1];
    if (!lastStatement || !ts.isExpressionStatement(lastStatement) || !ts.isIdentifier(lastStatement.expression)) {
      throw new Error('expected a trailing `dbValue;` reference statement in the fixture');
    }

    const node = lastStatement.expression;
    return { checker, dbType: checker.getTypeAtLocation(node), node };
  }

  it('scopes to a named table', () => {
    const { checker, dbType, node } = buildDbType(`
      interface DB { users: { id: number; name: string }; posts: { id: number; title: string } }
      declare const dbValue: DB;
    `);

    expect(getColumnNames(ts, checker, dbType, node, 'users').sort()).toEqual(['id', 'name']);
  });

  it('returns no columns for a FROM table that does not exist in the schema, instead of falling back to all tables', () => {
    const { checker, dbType, node } = buildDbType(`
      interface DB { users: { id: number; name: string }; posts: { id: number; title: string } }
      declare const dbValue: DB;
    `);

    expect(getColumnNames(ts, checker, dbType, node, 'userz')).toEqual([]);
    expect(getColumnType(ts, checker, dbType, node, 'userz', 'title')).toBeNull();
  });

  // Regression for #250: the type layer resolves identifiers
  // case-insensitively, so the plugin has to as well - otherwise it scopes to
  // nothing and offers no columns for a query tsc types fine.
  it('scopes to a table named in a different case', () => {
    const { checker, dbType, node } = buildDbType(`
      interface DB { users: { id: number; name: string }; posts: { id: number; title: string } }
      declare const dbValue: DB;
    `);

    expect(getColumnNames(ts, checker, dbType, node, 'USERS').sort()).toEqual(['id', 'name']);
    expect(getColumnType(ts, checker, dbType, node, 'Users', 'NAME')).not.toBeNull();
  });

  it('unions columns across all tables when no FROM table is given', () => {
    const { checker, dbType, node } = buildDbType(`
      interface DB { users: { id: number; name: string }; posts: { id: number; title: string } }
      declare const dbValue: DB;
    `);

    expect(getColumnNames(ts, checker, dbType, node, null).sort()).toEqual(['id', 'name', 'title']);
  });

  it('resolves a column type unambiguously when every table agrees on it, even with no FROM scoping', () => {
    const { checker, dbType, node } = buildDbType(`
      interface DB { users: { id: number; name: string }; posts: { id: number; title: string } }
      declare const dbValue: DB;
    `);

    const columnType = getColumnType(ts, checker, dbType, node, null, 'id');
    expect(columnType && checker.typeToString(columnType)).toBe('number');
  });

  it('refuses to guess a column type when tables disagree on it and there is no FROM scoping', () => {
    const { checker, dbType, node } = buildDbType(`
      interface DB { users: { id: number }; accounts: { id: string } }
      declare const dbValue: DB;
    `);

    expect(getColumnType(ts, checker, dbType, node, null, 'id')).toBeNull();
  });

  it('unions columns across an explicit array of tables, for JOIN scoping', () => {
    const { checker, dbType, node } = buildDbType(`
      interface DB {
        users: { id: number; name: string };
        posts: { id: number; title: string };
        comments: { id: number; body: string };
      }
      declare const dbValue: DB;
    `);

    expect(getColumnNames(ts, checker, dbType, node, ['users', 'posts']).sort()).toEqual([
      'id',
      'name',
      'title',
    ]);
    expect(getColumnNames(ts, checker, dbType, node, ['users', 'posts'])).not.toContain('body');
  });

  it('resolves a column type unambiguously across a joined table array', () => {
    const { checker, dbType, node } = buildDbType(`
      interface DB { users: { id: number; name: string }; posts: { id: number; title: string } }
      declare const dbValue: DB;
    `);

    const columnType = getColumnType(ts, checker, dbType, node, ['users', 'posts'], 'name');
    expect(columnType && checker.typeToString(columnType)).toBe('string');
  });

  it('refuses to guess a column type when joined tables in the array disagree on it', () => {
    const { checker, dbType, node } = buildDbType(`
      interface DB { users: { id: number }; accounts: { id: string } }
      declare const dbValue: DB;
    `);

    expect(getColumnType(ts, checker, dbType, node, ['users', 'accounts'], 'id')).toBeNull();
  });

  it('resolves an optional table key by stripping undefined (issue #164 repro)', () => {
    const { checker, dbType, node } = buildDbType(`
      interface DB { users?: { id: number; name: string } }
      declare const dbValue: DB;
    `);

    expect(getColumnNames(ts, checker, dbType, node, 'users').sort()).toEqual(['id', 'name']);
    const columnType = getColumnType(ts, checker, dbType, node, 'users', 'id');
    expect(columnType && checker.typeToString(columnType)).toBe('number');
  });

  it('resolves any table name against a Record<string, ...> schema (issue #164 repro)', () => {
    const { checker, dbType, node } = buildDbType(`
      type DB = Record<string, Record<string, unknown>>;
      declare const dbValue: DB;
    `);

    expect(getColumnNames(ts, checker, dbType, node, 'users')).toEqual([]);
    const columnType = getColumnType(ts, checker, dbType, node, 'users', 'id');
    expect(columnType && checker.typeToString(columnType)).toBe('unknown');
  });

  it('resolves a named table alongside a Record<string, ...> catch-all', () => {
    const { checker, dbType, node } = buildDbType(`
      interface DB {
        users: { id: number; name: string };
        [table: string]: Record<string, unknown>;
      }
      declare const dbValue: DB;
    `);

    expect(getColumnNames(ts, checker, dbType, node, 'users').sort()).toEqual(['id', 'name']);
    const columnType = getColumnType(ts, checker, dbType, node, 'ghost_table', 'anything');
    expect(columnType && checker.typeToString(columnType)).toBe('unknown');
  });
});
