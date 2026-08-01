import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const TABLE_COUNT = 100;
const FILLER_COLUMNS = 6;
const SHAPE_REPEATS = 4;

// Raised from 185,000 for #247: a quoted identifier may hold a space, and
// finding out whether one does costs a full-string scan per query - roughly
// 4% on every query, quoted or not, since the only way to skip the rewrite is
// to look for a quote first. The alternative was leaving `"first name"` and
// `[Order Details]` unusable, including in schemas `owlsql generate` writes
// itself.
//
// Raised again from 195,000 for #266: normalizing whitespace now runs one pass
// per character rather than one union match, which costs about 6% (five template
// splits per query instead of one) and buys back a compiler crash - a tab beside
// a newline, or any CRLF, used to exhaust the heap outright. Gating the passes
// was measured and came out worse, see the note in src/string.ts.
const MAX_INSTANTIATIONS = 200_000;

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PERF_DIR = join(ROOT, 'tests', 'perf');
const GENERATED_DIR = join(PERF_DIR, 'generated');

function tableName(index) {
  return `t_${String(index).padStart(3, '0')}`;
}

function renderTable(index) {
  const filler = Array.from(
    { length: FILLER_COLUMNS },
    (_unused, column) => `    col_${column}: string | null;`,
  ).join('\n');

  return [
    `  ${tableName(index)}: {`,
    '    id: number;',
    '    name: string;',
    '    email: string | null;',
    '    status: string;',
    '    active: boolean;',
    '    amount: number;',
    '    created_at: Date;',
    filler,
    '  };',
  ].join('\n');
}

function renderSchema() {
  const tables = Array.from({ length: TABLE_COUNT }, (_unused, index) => renderTable(index));
  return `export interface DB {\n${tables.join('\n')}\n}\n`;
}

const SHAPES = [
  (a) => ({ sql: `select id, name, email, created_at from ${a}`, kind: 'row' }),
  (a) => ({ sql: `select * from ${a}`, kind: 'row' }),
  (a, b) => ({
    sql: `select x.id, y.name, y.amount from ${a} as x join ${b} as y on x.id = y.id`,
    kind: 'row',
  }),
  (a) => ({ sql: `select status, count(*) as total from ${a} group by status`, kind: 'row' }),
  (a) => ({
    sql: `select id, case when active then 'on' else 'off' end as label from ${a}`,
    kind: 'row',
  }),
  (a) => ({
    sql: `with recent as (select id, name from ${a} where amount > $1) select id, name from recent`,
    kind: 'params',
  }),
  (a) => ({ sql: `select id, name from ${a} where id = $1 and status = $2`, kind: 'strict' }),
  (a, b) => ({ sql: `select id from ${a} union all select id from ${b}`, kind: 'row' }),
];

function renderQueries() {
  const lines = [
    "import type { Query, StrictQuery, Params } from '../../../src/index.js';",
    "import type { DB } from './schema.js';",
    '',
    'type RowKeys<Result extends readonly unknown[]> = keyof Result[number];',
    '',
  ];

  let index = 0;
  for (let repeat = 0; repeat < SHAPE_REPEATS; repeat += 1) {
    for (const shape of SHAPES) {
      const first = tableName((index * 7) % TABLE_COUNT);
      const second = tableName((index * 13 + 1) % TABLE_COUNT);
      const { sql, kind } = shape(first, second);

      if (kind === 'params') {
        lines.push(`export declare const p${index}: Params<DB, "${sql}">;`);
        lines.push(`export declare const k${index}: RowKeys<Query<DB, "${sql}">>;`);
      } else if (kind === 'strict') {
        lines.push(`export declare const k${index}: RowKeys<StrictQuery<DB, "${sql}">>;`);
        lines.push(`export declare const p${index}: Params<DB, "${sql}">;`);
      } else {
        lines.push(`export declare const k${index}: RowKeys<Query<DB, "${sql}">>;`);
      }

      index += 1;
    }
  }

  return `${lines.join('\n')}\n`;
}

function writeFixture() {
  rmSync(GENERATED_DIR, { recursive: true, force: true });
  mkdirSync(GENERATED_DIR, { recursive: true });
  writeFileSync(join(GENERATED_DIR, 'schema.ts'), renderSchema(), 'utf8');
  writeFileSync(join(GENERATED_DIR, 'queries.ts'), renderQueries(), 'utf8');
}

function readDiagnostic(output, label) {
  const match = new RegExp(`^${label}:\\s+([\\d.]+)`, 'm').exec(output);
  return match === null ? null : Number(match[1]);
}

function compile() {
  const tsc = join(ROOT, 'node_modules', 'typescript', 'bin', 'tsc');
  try {
    return execFileSync(
      process.execPath,
      [tsc, '--noEmit', '--extendedDiagnostics', '-p', join(PERF_DIR, 'tsconfig.json')],
      { encoding: 'utf8' },
    );
  } catch (error) {
    process.stderr.write(`${error.stdout ?? ''}${error.stderr ?? ''}\n`);
    throw new Error('The type-budget fixture failed to compile.');
  }
}

function main() {
  writeFixture();
  const output = compile();

  const instantiations = readDiagnostic(output, 'Instantiations');
  if (instantiations === null) {
    throw new Error('Could not read the instantiation count from tsc --extendedDiagnostics.');
  }

  const types = readDiagnostic(output, 'Types');
  const checkTime = readDiagnostic(output, 'Check time');
  const budgetUsed = Math.round((instantiations / MAX_INSTANTIATIONS) * 100);

  process.stdout.write(
    [
      `Tables:         ${TABLE_COUNT}`,
      `Queries:        ${SHAPES.length * SHAPE_REPEATS}`,
      `Types:          ${types ?? 'n/a'}`,
      `Check time:     ${checkTime ?? 'n/a'}s`,
      `Instantiations: ${instantiations} (${budgetUsed}% of the ${MAX_INSTANTIATIONS} budget)`,
      '',
    ].join('\n'),
  );

  if (instantiations > MAX_INSTANTIATIONS) {
    process.stderr.write(
      [
        `Type-instantiation budget exceeded: ${instantiations} > ${MAX_INSTANTIATIONS}.`,
        'Either the change made the parser recurse harder than it needs to, or the extra cost is',
        'understood and intended - in which case raise MAX_INSTANTIATIONS in scripts/type-budget.mjs',
        'in the same commit, so the new baseline is reviewed instead of drifting silently.',
        '',
      ].join('\n'),
    );
    process.exitCode = 1;
  }
}

main();
