import { describe, expect, it } from 'vitest';
import { collectNamedParameters, resolveMixedParameters } from '../src/adapters/named-params.js';

const AT_DOLLAR_COLON: ReadonlySet<string> = new Set(['@', '$', ':']);

describe('collectNamedParameters', () => {
  it('collects named parameters outside of literals and dollar-quoted bodies', () => {
    expect(collectNamedParameters('select 1 where id = @id', AT_DOLLAR_COLON)).toEqual(['@id']);
  });

  it('does not treat a $word inside a $$ ... $$ dollar-quoted body as a parameter', () => {
    const sql = "create function f() returns int as $$ select $foo from bar $$ language sql";
    expect(collectNamedParameters(sql, AT_DOLLAR_COLON)).toEqual([]);
  });

  it('does not treat a $word inside a $tag$ ... $tag$ dollar-quoted body as a parameter', () => {
    const sql = "create function f() returns int as $body$ select $foo from bar $body$ language sql";
    expect(collectNamedParameters(sql, AT_DOLLAR_COLON)).toEqual([]);
  });

  it('still collects a real parameter that follows a dollar-quoted body', () => {
    const sql = "create function f() returns int as $$ select 1 $$ language sql; select @id";
    expect(collectNamedParameters(sql, AT_DOLLAR_COLON)).toEqual(['@id']);
  });

  it('does not confuse a positional $1 placeholder for a dollar-quote opener', () => {
    expect(collectNamedParameters('select * from t where id = $1', AT_DOLLAR_COLON)).toEqual([
      '$1',
    ]);
  });

  it('still skips parameters inside a plain string literal', () => {
    expect(collectNamedParameters("select '@id' from t where x = @real", AT_DOLLAR_COLON)).toEqual(
      ['@real'],
    );
  });

  it('dedupes a repeated named parameter', () => {
    expect(
      collectNamedParameters('select * from t where a = @id or b = @id', AT_DOLLAR_COLON),
    ).toEqual(['@id']);
  });

  // T-SQL and SQLite, the two engines behind this scanner, have no backslash
  // escape: a literal ending in a backslash closes at that quote (issue #248).
  it('closes a literal ending in a backslash and collects what follows', () => {
    const sql = "select * from t where p = 'C:\\' and id = @id";
    expect(collectNamedParameters(sql, AT_DOLLAR_COLON)).toEqual(['@id']);
  });

  it('treats a doubled backslash before a quote as a real closing delimiter', () => {
    const sql = "select * from t where a = 'c:\\\\' and b = @id";
    expect(collectNamedParameters(sql, AT_DOLLAR_COLON)).toEqual(['@id']);
  });

  it('skips a parameter inside a literal whose body holds a backslash', () => {
    const sql = "select * from t where a = 'c:\\dir @fake' and b = @id";
    expect(collectNamedParameters(sql, AT_DOLLAR_COLON)).toEqual(['@id']);
  });

  it('skips a parameter-looking word inside a line comment', () => {
    const sql = 'select * from t where a = @x -- ping @alice\n and b = @y';
    expect(collectNamedParameters(sql, AT_DOLLAR_COLON)).toEqual(['@x', '@y']);
  });

  it('skips a parameter-looking word inside a block comment', () => {
    const sql = 'select * from t where a = @x /* @todo drop @this */ and b = @y';
    expect(collectNamedParameters(sql, AT_DOLLAR_COLON)).toEqual(['@x', '@y']);
  });

  it('skips a parameter-looking word inside an unterminated block comment', () => {
    expect(collectNamedParameters('select @x /* @todo', AT_DOLLAR_COLON)).toEqual(['@x']);
  });

  it('does not treat a quote inside a comment as a literal delimiter', () => {
    const sql = "select * from t where a = @x -- it's fine\n and b = @y";
    expect(collectNamedParameters(sql, AT_DOLLAR_COLON)).toEqual(['@x', '@y']);
  });

  it('skips a parameter-looking word inside a quoted identifier', () => {
    expect(
      collectNamedParameters('select "@a", `@b`, [@c] from t where x = @real', AT_DOLLAR_COLON),
    ).toEqual(['@real']);
  });

  it('still treats a -- inside a string literal as literal text', () => {
    const sql = "select * from t where a = '-- @fake' and b = @id";
    expect(collectNamedParameters(sql, AT_DOLLAR_COLON)).toEqual(['@id']);
  });

  it('handles a doubled quote inside a literal', () => {
    const sql = "select * from t where a = 'it''s @fake' and b = @id";
    expect(collectNamedParameters(sql, AT_DOLLAR_COLON)).toEqual(['@id']);
  });
});

describe('resolveMixedParameters', () => {
  it('assigns values to parameters that follow a literal ending in a backslash', () => {
    const sql = "select * from t where p = 'C:\\' and b = @id and c = @other";
    expect(resolveMixedParameters(sql, AT_DOLLAR_COLON, [1, 2])).toEqual({
      named: { '@id': 1, '@other': 2 },
      positional: [],
    });
  });

  it('does not consume a value for a placeholder inside a literal holding a backslash', () => {
    const sql = "select * from t where a = 'c:\\dir ?' and b = ?";
    expect(resolveMixedParameters(sql, AT_DOLLAR_COLON, [7])).toEqual({
      named: {},
      positional: [7],
    });
  });

  it('does not let a commented-out placeholder shift the values after it', () => {
    const sql = 'select * from t where a = @x -- ping @alice\n and b = @y';
    expect(resolveMixedParameters(sql, AT_DOLLAR_COLON, [1, 2])).toEqual({
      named: { '@x': 1, '@y': 2 },
      positional: [],
    });
  });

  it('does not consume a value for a ? inside a comment', () => {
    const sql = 'select * from t where a = ? /* is ? right */ and b = ?';
    expect(resolveMixedParameters(sql, AT_DOLLAR_COLON, [1, 2])).toEqual({
      named: {},
      positional: [1, 2],
    });
  });
});
