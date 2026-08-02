import { describe, expect, it } from 'vitest';
import { mssqlUrlToConfig } from '../src/cli/dialects/mssql.js';
import { detectDialect } from '../src/cli/generate.js';

describe('mssqlUrlToConfig', () => {
  it('translates a full mssql:// URL into a driver config', () => {
    expect(mssqlUrlToConfig('mssql://sa:S3cret@db.example.com:1433/app')).toEqual({
      server: 'db.example.com',
      user: 'sa',
      password: 'S3cret',
      database: 'app',
      port: 1433,
      options: { encrypt: true, trustServerCertificate: false },
    });
  });

  it('decodes percent-encoded credentials', () => {
    const config = mssqlUrlToConfig('sqlserver://u%40corp:p%23ss@host/db');
    expect(config.user).toBe('u@corp');
    expect(config.password).toBe('p#ss');
  });

  it('omits absent parts and honors query flags', () => {
    expect(mssqlUrlToConfig('mssql://host?encrypt=false&trustServerCertificate=true')).toEqual({
      server: 'host',
      options: { encrypt: false, trustServerCertificate: true },
    });
  });

  // Regression for #239: a backslash is a forbidden host character, so this URL
  // used to die inside `new URL` with a bare "Invalid URL".
  it('splits a named instance out of the host', () => {
    expect(mssqlUrlToConfig('mssql://sa:S3cret@localhost\\SQLEXPRESS/app')).toEqual({
      server: 'localhost',
      user: 'sa',
      password: 'S3cret',
      database: 'app',
      options: { encrypt: true, trustServerCertificate: false, instanceName: 'SQLEXPRESS' },
    });
  });

  it('keeps a named instance alongside an explicit port', () => {
    const config = mssqlUrlToConfig('mssql://host\\PROD:1433/db');
    expect(config.server).toBe('host');
    expect(config.port).toBe(1433);
    expect(config.options.instanceName).toBe('PROD');
  });

  it('explains what a valid connection string looks like instead of throwing "Invalid URL"', () => {
    expect(() => mssqlUrlToConfig('mssql://host:notaport/db')).toThrow(
      /Invalid SQL Server connection URL.*ADO string/s,
    );
  });

  it('does not leak the password when the URL cannot be parsed', () => {
    expect(() => mssqlUrlToConfig('mssql://sa:S3cret@host:notaport/db')).not.toThrow(/S3cret/);
  });

  // Regression for #306: `new URL` keeps a broken percent sequence verbatim, so
  // the throw came out of decodeURIComponent as a bare "URI malformed".
  it('explains an incomplete percent-escape instead of throwing "URI malformed"', () => {
    expect(() => mssqlUrlToConfig('mssql://sa:p%ss@host/db')).toThrow(
      /Invalid SQL Server connection URL.*%25/s,
    );
  });

  it.each([
    ['user', 'mssql://p%ss:S3cret@host/db'],
    ['host', 'mssql://sa:S3cret@ho%st/db'],
    ['database', 'mssql://sa:S3cret@host/d%b'],
  ])('explains an incomplete percent-escape in the %s', (_part, url) => {
    expect(() => mssqlUrlToConfig(url)).toThrow(/incomplete percent-escape/);
  });

  it('does not leak the password when a percent-escape is incomplete', () => {
    expect(() => mssqlUrlToConfig('mssql://sa:S3cret%@host/db')).not.toThrow(/S3cret/);
  });
});

describe('detectDialect for SQL Server inputs', () => {
  it('routes mssql:// and sqlserver:// URLs to mssql', () => {
    expect(detectDialect('mssql://host/db')).toBe('mssql');
    expect(detectDialect('sqlserver://host/db')).toBe('mssql');
  });

  it('routes ADO key=value strings to mssql instead of sqlite', () => {
    expect(detectDialect('Server=host;Database=db;User Id=u;Password=p')).toBe('mssql');
    expect(detectDialect('Data Source=host;Initial Catalog=db')).toBe('mssql');
  });

  it('still treats plain paths as sqlite', () => {
    expect(detectDialect('./app.db')).toBe('sqlite');
  });
});
