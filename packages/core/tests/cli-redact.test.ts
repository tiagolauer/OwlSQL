import { describe, expect, it } from 'vitest';
import { detectDialect, redactCredentials } from '../src/tooling/schema-generator/generate.js';
import { introspectSqlite } from '../src/tooling/introspection/sqlite.js';
import { sqliteAvailable } from './sqlite-availability.js';

describe('redactCredentials', () => {
  it('replaces the user:password segment with ***', () => {
    expect(redactCredentials('postgres://user:S3cret@host/db')).toBe('postgres://***@host/db');
  });

  it('replaces a lone username segment', () => {
    expect(redactCredentials('mysql://root@host/db')).toBe('mysql://***@host/db');
  });

  it('replaces credentials in a mistyped single-slash URL', () => {
    expect(redactCredentials('postgres:/user:S3cret@host/db')).toBe('postgres:/***@host/db');
  });

  it('replaces the password in an ADO/DSN connection string', () => {
    expect(redactCredentials('Uid=sa;Pwd=S3cret;Initial Catalog=db')).toBe(
      'Uid=sa;Pwd=***;Initial Catalog=db',
    );
    expect(redactCredentials('Server=host;Password=S3cret;Database=db')).toBe(
      'Server=host;Password=***;Database=db',
    );
  });

  // Regression for #251: a URL parser splits userinfo at the last "@" of the
  // authority, so an unencoded "@" in the password is legal - and the tail of
  // it used to survive redaction.
  it('replaces a password containing an unencoded @', () => {
    expect(redactCredentials('mysql://root:p@ss@localhost/db')).toBe('mysql://***@localhost/db');
    expect(redactCredentials('mysql://root:p@ss@localhost')).toBe('mysql://***@localhost');
  });

  it('does not read an @ in the path or query as userinfo', () => {
    expect(redactCredentials('postgres://host/db?application_name=svc@prod')).toBe(
      'postgres://host/db?application_name=svc@prod',
    );
    expect(redactCredentials('mssql://sa:pw@host/db?tag=a@b')).toBe('mssql://***@host/db?tag=a@b');
  });

  it('leaves credential-free URLs untouched', () => {
    expect(redactCredentials('postgres://host/db')).toBe('postgres://host/db');
    expect(redactCredentials('./local.sqlite')).toBe('./local.sqlite');
  });
});

describe('detectDialect error redaction', () => {
  it('does not echo the password on an unrecognized scheme', () => {
    let message = '';
    try {
      detectDialect('postgress://user:S3cret@host/db');
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }

    expect(message).toContain('postgress://***@host/db');
    expect(message).not.toContain('S3cret');
    expect(message).not.toContain('user:');
  });
});

// Regression for #278: a second scheme token ("jdbc:postgresql://") and a
// missing colon ("postgres//") match neither SCHEME_PATTERN nor the credential
// blocklist, so both land in the sqlite fallback, which echoed the raw string.
describe.skipIf(!sqliteAvailable)('sqlite missing-file error redaction', () => {
  it.each([
    'jdbc:postgresql://user:S3cret@host/db',
    'postgres//user:S3cret@host/db',
  ])('does not echo the password for %s', async (url) => {
    expect(detectDialect(url)).toBe('sqlite');

    let message = '';
    try {
      await introspectSqlite({ url });
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }

    expect(message).toContain('SQLite database file not found');
    expect(message).toContain('***@host/db');
    expect(message).not.toContain('S3cret');
  });

  it('still names an ordinary missing path in full', async () => {
    let message = '';
    try {
      await introspectSqlite({ url: './no-such-database.db' });
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }

    expect(message).toContain('"./no-such-database.db"');
  });
});
