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

  it('collects parameters that follow a backslash-escaped quote inside a literal', () => {
    const sql = "select * from t where a = 'it\\'s' and b = @id and c = @other";
    expect(collectNamedParameters(sql, AT_DOLLAR_COLON)).toEqual(['@id', '@other']);
  });

  it('treats a doubled backslash before a quote as a real closing delimiter', () => {
    const sql = "select * from t where a = 'c:\\\\' and b = @id";
    expect(collectNamedParameters(sql, AT_DOLLAR_COLON)).toEqual(['@id']);
  });

  it('still skips a parameter inside a literal that contains an escaped quote', () => {
    const sql = "select * from t where a = 'it\\'s @fake' and b = @id";
    expect(collectNamedParameters(sql, AT_DOLLAR_COLON)).toEqual(['@id']);
  });
});

describe('resolveMixedParameters', () => {
  it('assigns values to parameters that follow a backslash-escaped quote', () => {
    const sql = "select * from t where a = 'it\\'s' and b = @id and c = @other";
    expect(resolveMixedParameters(sql, AT_DOLLAR_COLON, [1, 2])).toEqual({
      named: { '@id': 1, '@other': 2 },
      positional: [],
    });
  });

  it('does not consume a value for a placeholder inside an escaped-quote literal', () => {
    const sql = "select * from t where a = 'it\\'s ?' and b = ?";
    expect(resolveMixedParameters(sql, AT_DOLLAR_COLON, [7])).toEqual({
      named: {},
      positional: [7],
    });
  });
});
