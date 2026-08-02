import { describe, it, expect, afterAll, afterEach } from 'vitest';
import { rmSync } from 'node:fs';
import ts from 'typescript';
import detectModule from '../src/detect.cts';
import { buildProgram, loadDiagnostics } from './test-helpers.js';

const { findAllQueryLiterals } = detectModule;
const { diagnostics: diagnosticsModule, dir: diagnosticsDir } = loadDiagnostics();
const { getQueryDiagnostics } = diagnosticsModule;

afterAll(() => {
  rmSync(diagnosticsDir, { recursive: true, force: true });
});

const FIXTURE = `
import type { TypedDb } from '@owlsql/core';

interface DB {
  users: { id: number; name: string };
  posts: { id: number; title: string; user_id: number };
}

declare const db: TypedDb<DB>;
`;

function diagnosticsFor(query: string, fixture: string = FIXTURE): { message: string; text: string }[] {
  const source = `${fixture}\ndb.query(\`${query}\`);\n`;
  const { program, sourceFile, dir } = buildProgram(source, 'owlsql-ts-plugin-diagnostics-');
  try {
    const checker = program.getTypeChecker();
    const matches = findAllQueryLiterals(ts, checker, sourceFile);
    expect(matches).toHaveLength(1);
    const [match] = matches;
    if (!match) return [];
    return getQueryDiagnostics(ts, checker, match.dbType, match.literal, sourceFile).map((span) => ({
      message: span.message,
      text: sourceFile.text.slice(span.start, span.start + span.length),
    }));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe('ts-plugin diagnostics: getQueryDiagnostics', () => {
  it('reports no diagnostics for a valid query', () => {
    expect(diagnosticsFor('select id, name from users')).toEqual([]);
  });

  it('reports an unknown column in the SELECT list', () => {
    expect(diagnosticsFor('select id, nope from users')).toEqual([
      { message: 'unknown column: nope', text: 'nope' },
    ]);
  });

  // Regression for #250: `select id from USERS` compiles to { id: number }[],
  // so a warning on it is a false positive the user cannot act on.
  it('accepts a table and a column written in a different case', () => {
    expect(diagnosticsFor('select id from USERS')).toEqual([]);
    expect(diagnosticsFor('SELECT ID FROM users')).toEqual([]);
    expect(diagnosticsFor('select id from users where NAME = $1')).toEqual([]);
  });

  it('reports an unknown table in the FROM clause', () => {
    expect(diagnosticsFor('select id from ghosts')).toEqual([
      { message: 'unknown table: ghosts', text: 'ghosts' },
    ]);
  });

  it('resolves a qualified column against its JOINed alias', () => {
    expect(
      diagnosticsFor('select u.id, p.title from users u join posts p on p.user_id = u.id'),
    ).toEqual([]);
  });

  it('reports an unknown column on a specific alias', () => {
    expect(
      diagnosticsFor('select u.nope from users u join posts p on p.user_id = u.id'),
    ).toEqual([{ message: 'unknown column: nope', text: 'nope' }]);
  });

  it('reports an unknown alias qualifier', () => {
    expect(diagnosticsFor('select z.id from users u')).toEqual([
      { message: 'unknown alias: z', text: 'z' },
    ]);
  });

  it('reports an ambiguous unqualified column across a join', () => {
    expect(diagnosticsFor('select id from users u join posts p on p.user_id = u.id')).toEqual([
      { message: 'ambiguous column: id', text: 'id' },
    ]);
  });

  it('skips validation for function calls, literals, and star', () => {
    expect(
      diagnosticsFor("select *, count(*), 'literal', 1, name from users"),
    ).toEqual([]);
  });

  it('does not run without a FROM clause', () => {
    expect(diagnosticsFor('select nope')).toEqual([]);
  });

  it('ignores a table named inside a line comment (issue #138 repro)', () => {
    expect(diagnosticsFor('select id -- from ghosts\nfrom users')).toEqual([]);
  });

  it('ignores a table named inside a block comment', () => {
    expect(diagnosticsFor('select id /* from ghosts */ from users')).toEqual([]);
  });

  it('does not treat a -- inside a string literal as a comment', () => {
    expect(diagnosticsFor("select name from users where name = 'a -- not a comment'")).toEqual([]);
  });

  it('anchors the diagnostic span correctly across CRLF line breaks (issue #137 repro)', () => {
    expect(diagnosticsFor('select id,\r\n  bogus_col\r\nfrom users')).toEqual([
      { message: 'unknown column: bogus_col', text: 'bogus_col' },
    ]);
  });

  it('anchors a second diagnostic after multiple preceding CRLF line breaks', () => {
    expect(
      diagnosticsFor('select id,\r\n  name,\r\n  nope\r\nfrom users\r\nwhere id = 1'),
    ).toEqual([{ message: 'unknown column: nope', text: 'nope' }]);
  });

  it('does not flag valid columns on an optional table key (issue #164 repro)', () => {
    const fixture = `
      import type { TypedDb } from '@owlsql/core';

      interface DB {
        users?: { id: number; name: string };
      }

      declare const db: TypedDb<DB>;
    `;
    expect(diagnosticsFor('select id, name from users', fixture)).toEqual([]);
  });

  it('still reports an unknown column on an optional table key', () => {
    const fixture = `
      import type { TypedDb } from '@owlsql/core';

      interface DB {
        users?: { id: number; name: string };
      }

      declare const db: TypedDb<DB>;
    `;
    expect(diagnosticsFor('select id, nope from users', fixture)).toEqual([
      { message: 'unknown column: nope', text: 'nope' },
    ]);
  });

  it('does not flag any table as unknown against a Record<string, ...> schema (issue #164 repro)', () => {
    const fixture = `
      import type { TypedDb } from '@owlsql/core';

      type DB = Record<string, Record<string, unknown>>;

      declare const db: TypedDb<DB>;
    `;
    expect(diagnosticsFor('select id, name from users', fixture)).toEqual([]);
  });

  it('does not flag a CTE name as an unknown table (issue #165 repro)', () => {
    expect(
      diagnosticsFor('with recent_users as (select id from users) select id, name from recent_users'),
    ).toEqual([]);
  });

  it('reports an unknown table in the outer FROM clause of a CTE query', () => {
    expect(
      diagnosticsFor('with recent_users as (select id from users) select id from ghosts'),
    ).toEqual([{ message: 'unknown table: ghosts', text: 'ghosts' }]);
  });

  it('reports an unknown column in the outer SELECT list of a CTE query', () => {
    expect(
      diagnosticsFor('with recent_users as (select id from users) select id, nope from users'),
    ).toEqual([{ message: 'unknown column: nope', text: 'nope' }]);
  });

  it('does not flag any of several comma-separated CTE names as unknown tables', () => {
    expect(
      diagnosticsFor(
        'with a as (select id from users), b as (select id from posts) select id from a join b on a.id = b.id',
      ),
    ).toEqual([]);
  });

  it('reports an unknown column referenced in the WHERE clause (issue #174 repro)', () => {
    expect(diagnosticsFor("select id from users where naem = 'x'")).toEqual([
      { message: 'unknown column: naem', text: 'naem' },
    ]);
  });

  it('reports an unknown alias qualifier in the WHERE clause', () => {
    expect(diagnosticsFor('select id from users u where z.id = 1')).toEqual([
      { message: 'unknown alias: z', text: 'z' },
    ]);
  });

  it('reports an unknown column on a specific alias in the WHERE clause', () => {
    expect(
      diagnosticsFor('select u.id from users u join posts p on p.user_id = u.id where u.nope = 1'),
    ).toEqual([{ message: 'unknown column: nope', text: 'nope' }]);
  });

  it('reports an ambiguous unqualified column in the WHERE clause', () => {
    expect(
      diagnosticsFor('select u.id from users u join posts p on p.user_id = u.id where id = 1'),
    ).toEqual([{ message: 'ambiguous column: id', text: 'id' }]);
  });

  it('reports no diagnostics for a valid WHERE clause with AND/OR and a trailing operand', () => {
    expect(
      diagnosticsFor("select id from users where name = 'ada' and id = 1 or id = 2"),
    ).toEqual([]);
  });

  it('does not flag literal or placeholder operands in the WHERE clause', () => {
    expect(diagnosticsFor('select id from users where id = $1 and name is not null')).toEqual([]);
  });

  it('does not flag a valid BETWEEN clause', () => {
    expect(diagnosticsFor('select id from users where id between 1 and 10')).toEqual([]);
  });

  it('skips WHERE diagnostics entirely once a paren appears, rather than risking a false positive', () => {
    expect(
      diagnosticsFor("select id from users where id in (1, 2, 3) and naem = 'x'"),
    ).toEqual([]);
  });

  it('does not let an ORDER BY alias bleed into WHERE-clause validation', () => {
    expect(
      diagnosticsFor("select id from users where name = 'ada' order by id desc"),
    ).toEqual([]);
  });

  it('reports a WHERE-clause typo alongside a genuinely unrelated ORDER BY clause', () => {
    expect(
      diagnosticsFor('select id from users where naem = 1 order by id desc'),
    ).toEqual([{ message: 'unknown column: naem', text: 'naem' }]);
  });

  it('stops the WHERE clause at an ORDER BY on the next line', () => {
    expect(diagnosticsFor('select id from users\nwhere id = 1\norder by name desc')).toEqual([]);
  });

  it('stops the WHERE clause at a GROUP BY on the next line', () => {
    expect(diagnosticsFor('select id from users\nwhere id = 1\ngroup by name')).toEqual([]);
  });

  it('stops the WHERE clause at a tab-separated LIMIT', () => {
    expect(diagnosticsFor('select id from users where id = 1\tlimit 10')).toEqual([]);
  });

  it('still reports a WHERE-clause typo in a multi-line query', () => {
    expect(diagnosticsFor('select id from users\nwhere naem = 1\norder by name desc')).toEqual([
      { message: 'unknown column: naem', text: 'naem' },
    ]);
  });

  // Regression for #242: the joined table was never scanned when the first
  // table had no alias, so every reference to it read as an unknown alias.
  it('reports nothing for a plain join written without aliases', () => {
    expect(
      diagnosticsFor('select posts.title from users join posts on users.id = posts.user_id'),
    ).toEqual([]);
  });

  it('reports nothing for a join written with USING', () => {
    expect(diagnosticsFor('select posts.title from users join posts using (id)')).toEqual([]);
  });

  it('reports nothing for a comma-joined FROM list', () => {
    expect(diagnosticsFor('select posts.title from users, posts where users.id = 1')).toEqual([]);
  });

  it('still reports a typo on a joined table written without aliases', () => {
    expect(
      diagnosticsFor('select posts.titel from users join posts on users.id = posts.user_id'),
    ).toEqual([{ message: 'unknown column: titel', text: 'titel' }]);
  });

  // Regression for #293: findSources drops CTE names, so every alias- or
  // name-qualified reference to a CTE was reported as an unknown alias while
  // the core type layer resolves all of them.
  describe('CTE-qualified references', () => {
    it('does not report an alias given to a CTE', () => {
      expect(
        diagnosticsFor('with recent as (select id from users) select r.id from recent r'),
      ).toEqual([]);
    });

    it('does not report a CTE referenced by its own name', () => {
      expect(diagnosticsFor('with recent as (select id from users) select recent.id from recent')).toEqual(
        [],
      );
    });

    it('does not report a CTE alias in the WHERE clause', () => {
      expect(
        diagnosticsFor(
          'with recent as (select id from users) select r.id from recent r where r.id = 1',
        ),
      ).toEqual([]);
    });

    it('does not report the query type-locked in tests/cte.test-d.ts', () => {
      expect(
        diagnosticsFor(
          'with popular as (select id, title from posts) select u.name, p.title from users u join popular p on u.id = p.id',
        ),
      ).toEqual([]);
    });

    it('still reports a qualifier that is neither a source nor a CTE', () => {
      expect(
        diagnosticsFor('with recent as (select id from users) select z.id from recent r'),
      ).toEqual([{ message: 'unknown alias: z', text: 'z' }]);
    });
  });

  // Regression for #294: the scanner pooled both branches of a set operation
  // into one scope, so a column name they share - which is every column, since
  // branches have to be compatible - came back as ambiguous.
  describe('set operations', () => {
    it('does not report a shared column name across UNION branches', () => {
      expect(diagnosticsFor('select id from users union select id from posts')).toEqual([]);
    });

    it('does not report across UNION ALL, INTERSECT or EXCEPT either', () => {
      expect(diagnosticsFor('select id from users union all select id from posts')).toEqual([]);
      expect(diagnosticsFor('select id from users intersect select id from posts')).toEqual([]);
      expect(diagnosticsFor('select id from users except select id from posts')).toEqual([]);
    });

    it('still reports a typo in the first branch', () => {
      expect(diagnosticsFor('select nope from users union select id from posts')).toEqual([
        { message: 'unknown column: nope', text: 'nope' },
      ]);
    });

    it('still reports an ambiguous column inside the first branch itself', () => {
      expect(
        diagnosticsFor('select id from users join posts on users.id = posts.user_id union select id from posts'),
      ).toEqual([{ message: 'ambiguous column: id', text: 'id' }]);
    });

    it('does not cut the statement at a union inside a subquery', () => {
      expect(
        diagnosticsFor('select nope from users where id in (select id from posts union select id from posts)'),
      ).toEqual([{ message: 'unknown column: nope', text: 'nope' }]);
    });
  });
});
