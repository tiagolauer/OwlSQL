import { describe, it, expect } from 'vitest';
import { parseFlags, parseTableList } from '../src/cli/index';

describe('parseFlags', () => {
  it('parses the spaced form', () => {
    const flags = parseFlags(['--url', 'postgres://localhost/db', '--out', './schema.ts']);
    expect(flags.get('url')).toBe('postgres://localhost/db');
    expect(flags.get('out')).toBe('./schema.ts');
  });

  it('parses the --flag=value form', () => {
    const flags = parseFlags(['--url=postgres://localhost/db', '--schema=app']);
    expect(flags.get('url')).toBe('postgres://localhost/db');
    expect(flags.get('schema')).toBe('app');
  });

  it('mixes the spaced and equals forms in the same call', () => {
    const flags = parseFlags(['--url=postgres://localhost/db', '--out', './schema.ts']);
    expect(flags.get('url')).toBe('postgres://localhost/db');
    expect(flags.get('out')).toBe('./schema.ts');
  });

  it('passes a value starting with -- through the equals form', () => {
    const flags = parseFlags(['--url=--weird-value']);
    expect(flags.get('url')).toBe('--weird-value');
  });

  it('still rejects a missing value in the spaced form', () => {
    expect(() => parseFlags(['--url'])).toThrow('Missing value for --url');
    expect(() => parseFlags(['--url', '--out', './schema.ts'])).toThrow('Missing value for --url');
  });

  it('rejects unknown flags instead of ignoring them', () => {
    expect(() => parseFlags(['--output', './x.ts'])).toThrow('Unknown flag --output');
    expect(() => parseFlags(['--shema', 'app'])).toThrow('Unknown flag --shema');
  });

  it('rejects positional arguments', () => {
    expect(() => parseFlags(['generate.ts'])).toThrow('Unexpected argument "generate.ts"');
  });

  it('rejects duplicate flags instead of last-win', () => {
    expect(() => parseFlags(['--out', 'a.ts', '--out', 'b.ts'])).toThrow('Duplicate flag --out');
  });

  it('treats --help and --version as boolean flags', () => {
    expect(parseFlags(['--help']).has('help')).toBe(true);
    expect(parseFlags(['--version']).has('version')).toBe(true);
    const flags = parseFlags(['--help', '--url', 'x']);
    expect(flags.get('url')).toBe('x');
  });

  it('accepts --table and --exclude lists', () => {
    const flags = parseFlags(['--table', 'users,posts', '--exclude', 'migrations']);
    expect(flags.get('table')).toBe('users,posts');
    expect(flags.get('exclude')).toBe('migrations');
  });

  it('treats --check as a boolean flag alongside --url', () => {
    const flags = parseFlags(['--url', 'postgres://localhost/db', '--check']);
    expect(flags.has('check')).toBe(true);
    expect(flags.get('url')).toBe('postgres://localhost/db');
  });

  // Regression for #241: the value was dropped, so --check=false enabled the
  // check and exited 1 on drift - the opposite of what was asked for.
  it('rejects a value on a boolean flag instead of ignoring it', () => {
    expect(() => parseFlags(['--check=false'])).toThrow('--check does not take a value.');
    expect(() => parseFlags(['--help=no'])).toThrow('--help does not take a value.');
    expect(() => parseFlags(['--version=1'])).toThrow('--version does not take a value.');
  });
});

describe('parseTableList', () => {
  it('splits and trims a list', () => {
    expect(parseTableList('users, posts ,orders', 'table')).toEqual(['users', 'posts', 'orders']);
  });

  it('returns undefined when the flag was not given', () => {
    expect(parseTableList(undefined, 'table')).toBeUndefined();
  });

  // Regression for #253: an empty list collapsed to undefined, which means
  // "no filter" downstream - so --table= generated the whole schema and
  // printed the usual success line.
  it('rejects a list with no usable name instead of silently dropping the filter', () => {
    expect(() => parseTableList('', 'table')).toThrow('--table needs at least one table name.');
    expect(() => parseTableList(' , ,', 'table')).toThrow('--table needs at least one table name.');
    expect(() => parseTableList('', 'exclude')).toThrow(
      '--exclude needs at least one table name.',
    );
  });
});
