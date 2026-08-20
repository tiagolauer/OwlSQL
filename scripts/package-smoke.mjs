import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CONSUMER_PACKAGES = [
  '@types/mssql',
  '@types/pg',
  'kysely',
  'mssql',
  'mysql2',
  'pg',
  'postgres',
];
const REMOVED_EXPORTS = [
  'FunctionReturnTypes',
  'ParseSelect',
  'ParseStatement',
  'ParsedStatement',
  'Source',
];

function runNpm(args, options) {
  const npmCli = process.env.npm_execpath;
  if (npmCli === undefined) {
    throw new Error('npm_execpath is required to run the package smoke test.');
  }
  return execFileSync(process.execPath, [npmCli, ...args], options);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function consumerSpecs(packageJson) {
  return CONSUMER_PACKAGES.map((name) => {
    const version = packageJson.devDependencies?.[name] ?? packageJson.peerDependencies?.[name];
    if (typeof version !== 'string') {
      throw new Error(`Missing package version for ${name}.`);
    }
    return `${name}@${version}`;
  });
}

function pack(destination) {
  const output = runNpm(
    ['pack', '--json', '--pack-destination', destination],
    { cwd: ROOT, encoding: 'utf8' },
  );
  const result = JSON.parse(output);
  if (!Array.isArray(result) || typeof result[0]?.filename !== 'string') {
    throw new Error('npm pack did not return a tarball filename.');
  }
  return join(destination, result[0].filename);
}

function assertPublicDeclarations() {
  const declarations = readFileSync(join(ROOT, 'dist', 'index.d.ts'), 'utf8');
  for (const name of REMOVED_EXPORTS) {
    if (new RegExp(`\\b${name}\\b`).test(declarations)) {
      throw new Error(`Removed export is still public: ${name}.`);
    }
  }
}

function writeConsumer(consumer) {
  writeJson(join(consumer, 'package.json'), {
    name: 'owlsql-package-smoke',
    private: true,
    type: 'module',
  });

  writeFileSync(
    join(consumer, 'index.ts'),
    `import {
  ResultStatus,
  createTypedDb,
  type Params,
  type Query,
} from '@owlsql/core';

import { createPgExecutor } from '@owlsql/core/pg';
import { createMysql2Executor } from '@owlsql/core/mysql2';
import { createPostgresJsExecutor } from '@owlsql/core/postgres';
import { createNodeSqliteExecutor } from '@owlsql/core/node-sqlite';
import { createMssqlExecutor } from '@owlsql/core/mssql';
import { createKyselyExecutor } from '@owlsql/core/kysely';

interface DB {
  users: { id: number; name: string };
}

type Q = Query<DB, 'select id, name from users'>;
type P = Params<DB, 'select id from users where id = $1'>;

declare const q: Q;
declare const p: P;
void q;
void p;
void ResultStatus;
void createTypedDb;
void createPgExecutor;
void createMysql2Executor;
void createPostgresJsExecutor;
void createNodeSqliteExecutor;
void createMssqlExecutor;
void createKyselyExecutor;
`,
    'utf8',
  );

  writeJson(join(consumer, 'tsconfig.json'), {
    compilerOptions: {
      target: 'ES2022',
      strict: true,
      module: 'ESNext',
      moduleResolution: 'Bundler',
      noEmit: true,
    },
    include: ['index.ts'],
  });
}

function main() {
  const temporary = mkdtempSync(join(tmpdir(), 'owlsql-package-smoke-'));
  const consumer = join(temporary, 'consumer');

  try {
    const packageJson = readJson(join(ROOT, 'package.json'));
    assertPublicDeclarations();
    const tarball = pack(temporary);
    mkdirSync(consumer);
    writeConsumer(consumer);
    runNpm(
      [
        'install',
        '--ignore-scripts',
        '--no-package-lock',
        '--no-audit',
        '--no-fund',
        tarball,
        ...consumerSpecs(packageJson),
      ],
      { cwd: consumer, stdio: 'inherit' },
    );
    execFileSync(
      process.execPath,
      [
        join(ROOT, 'node_modules', 'typescript', 'bin', 'tsc'),
        '--pretty',
        'false',
        '-p',
        join(consumer, 'tsconfig.json'),
      ],
      { cwd: consumer, stdio: 'inherit' },
    );
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
}

main();
