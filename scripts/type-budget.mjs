import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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
// Raised again from 200,000 for #282: strict mode now resolves the INSERT
// column list and the UPDATE SET targets against the schema, which are
// guaranteed runtime errors nothing checked before. The check itself is gated
// on a non-empty column text, so a SELECT pays only for carrying the empty
// string; the ~4.5% is the two clause scans a write statement now runs
// (`SplitAtTopLevelKeyword` for VALUES/SELECT and for SET) plus the extra
// field on every parsed statement. Measured: 192,486 -> 201,322.
// Raised again from 210,000 for the 2026-08-02 audit batch, which landed 31
// fixes at once. The fixture goes 192,486 -> 212,616 (+10.5%). Where it went,
// measured per change on its own branch: correlated subqueries carry the outer
// FROM list into every subquery scan (+7.2k, #273), strict mode now resolves
// the INSERT column list and SET targets (+8.8k, #282) and the SELECT half of
// an INSERT ... SELECT (+1.6k, #272), JOIN ... USING carries its merged
// columns (+2.2k, #284), a repeated placeholder reports the conflict rather
// than collapsing to never (+1.5k, #302), and comparison parameters drop null
// (+1.5k, #299). Two changes paid part of it back: the comment/literal scan
// now dispatches on the character it already read (-7.7k, #287) and the bare
// alias split stops building a candidate it discards (-1k, #276).
// Raised from 225,000 for the M4 WITH/CTE cutover. Resolving CTE outputs as
// ordered scope sources moved the public fixture from 223,663 to 225,590
// instantiations (+0.86%); 230,000 keeps a reviewed 2% margin without hiding
// the measured baseline.
// Raised from 230,000 for the M5 INSERT cutover. Routing INSERT result and
// parameter inference through structured Next IR moved the public fixture from
// 225,590 to 231,605 instantiations (+2.67%); 235,000 keeps a reviewed 1.5%
// margin while the remaining DML statements migrate independently.
const MAX_INSTANTIATIONS = 235_000;

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PERF_DIR = join(ROOT, 'tests', 'perf');
const GENERATED_DIR = join(PERF_DIR, 'generated');
const BASELINE_FILE = join(PERF_DIR, 'baseline.json');
const NEXT_BASELINE_FILE = join(PERF_DIR, 'select-next-baseline.json');

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

function compile(configFile = 'tsconfig.json') {
  const tsc = join(ROOT, 'node_modules', 'typescript', 'bin', 'tsc');
  try {
    const output = execFileSync(
      process.execPath,
      [tsc, '--noEmit', '--extendedDiagnostics', '-p', join(PERF_DIR, configFile)],
      { encoding: 'utf8' },
    );
    const instantiations = readDiagnostic(output, 'Instantiations');
    if (instantiations === null) {
      throw new Error('Could not read the instantiation count from tsc --extendedDiagnostics.');
    }

    return {
      instantiations,
      types: readDiagnostic(output, 'Types'),
      checkTime: readDiagnostic(output, 'Check time'),
    };
  } catch (error) {
    process.stderr.write(`${error.stdout ?? ''}${error.stderr ?? ''}\n`);
    throw new Error('The type-budget fixture failed to compile.');
  }
}

function readTypescriptVersion() {
  const packageJson = JSON.parse(
    readFileSync(join(ROOT, 'node_modules', 'typescript', 'package.json'), 'utf8'),
  );
  if (typeof packageJson.version !== 'string') {
    throw new Error('Could not read the installed TypeScript version.');
  }
  return packageJson.version;
}

function writeBaseline(file, instantiations) {
  writeFileSync(
    file,
    `${JSON.stringify({ typescript: readTypescriptVersion(), instantiations }, null, 2)}\n`,
    'utf8',
  );
}

function readBaseline(file) {
  const baseline = JSON.parse(readFileSync(file, 'utf8'));
  if (typeof baseline.instantiations !== 'number' || baseline.instantiations <= 0) {
    throw new Error('The type-instantiation baseline is invalid.');
  }
  return baseline.instantiations;
}

function main() {
  writeFixture();
  const { instantiations, types, checkTime } = compile();
  const next = compile('tsconfig.next.json');

  if (process.argv.includes('--write-baseline')) {
    writeBaseline(BASELINE_FILE, instantiations);
    writeBaseline(NEXT_BASELINE_FILE, next.instantiations);
    process.stdout.write(
      `Wrote baselines: public=${instantiations}, next=${next.instantiations} instantiations\n`,
    );
    return;
  }

  const baseline = readBaseline(BASELINE_FILE);
  const nextBaseline = readBaseline(NEXT_BASELINE_FILE);
  const delta = instantiations - baseline;
  const nextDelta = next.instantiations - nextBaseline;
  const deltaPercent = (delta / baseline) * 100;
  const nextDeltaPercent = (nextDelta / nextBaseline) * 100;
  const deltaSign = delta >= 0 ? '+' : '';
  const nextDeltaSign = nextDelta >= 0 ? '+' : '';
  const budgetUsed = Math.round((instantiations / MAX_INSTANTIATIONS) * 100);

  process.stdout.write(
    [
      `Tables:         ${TABLE_COUNT}`,
      `Queries:        ${SHAPES.length * SHAPE_REPEATS}`,
      `Types:          ${types ?? 'n/a'}`,
      `Check time:     ${checkTime ?? 'n/a'}s`,
      `Instantiations: ${instantiations} (${budgetUsed}% of the ${MAX_INSTANTIATIONS} budget)`,
      `Baseline:       ${baseline}`,
      `Delta:          ${deltaSign}${delta} (${deltaSign}${deltaPercent.toFixed(2)}%)`,
      `Next:           ${next.instantiations}`,
      `Next baseline:  ${nextBaseline}`,
      `Next delta:     ${nextDeltaSign}${nextDelta} (${nextDeltaSign}${nextDeltaPercent.toFixed(2)}%)`,
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
