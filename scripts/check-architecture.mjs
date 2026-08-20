import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SOURCE_EXTENSIONS = ['.ts', '.cts', '.mts'];
const SOURCE_DIRECTORIES = ['packages/core/src', 'packages/ts-plugin/src'];
const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const RULES = [
  {
    from: 'packages/core/src/language/',
    forbidden: [
      'packages/core/src/compiler/',
      'packages/core/src/runtime/',
      'packages/core/src/public/',
    ],
    name: 'language isolation',
  },
  {
    from: 'packages/core/src/runtime/',
    forbidden: [
      'packages/core/src/compiler/',
      'packages/core/src/language/',
    ],
    name: 'runtime isolation',
  },
  {
    from: 'packages/core/src/compiler/',
    forbidden: ['packages/core/src/runtime/'],
    name: 'compiler isolation',
  },
  {
    from: 'packages/core/src/adapters/',
    forbidden: [
      'packages/core/src/compiler/',
      'packages/core/src/language/',
      'packages/core/src/tooling/',
    ],
    name: 'adapter isolation',
  },
  {
    from: 'packages/core/src/tooling/',
    forbidden: [
      'packages/core/src/compiler/',
      'packages/core/src/language/',
      'packages/core/src/runtime/',
      'packages/core/src/public/',
      'packages/core/src/adapters/',
    ],
    allowTargets: ['packages/core/src/compiler/schema/'],
    name: 'tooling isolation',
  },
  {
    from: 'packages/ts-plugin/src/',
    forbidden: ['packages/core/src/'],
    allowTargets: ['packages/core/src/compiler/analysis.ts'],
    name: 'editor plugin contract',
  },
];

function normalize(path) {
  return path.replaceAll('\\', '/');
}

function collectSourceFiles(root, directory = 'src') {
  const absoluteDirectory = join(root, directory);
  if (!existsSync(absoluteDirectory)) {
    return [];
  }

  return readdirSync(absoluteDirectory, { withFileTypes: true }).flatMap((entry) => {
    const child = join(directory, entry.name);
    if (entry.isDirectory()) {
      return collectSourceFiles(root, child);
    }
    return SOURCE_EXTENSIONS.some((extension) => entry.name.endsWith(extension))
      ? [normalize(child)]
      : [];
  });
}

function importSpecifiers(source) {
  return [...source.matchAll(
    /(?:import|export)\s+(?:type\s+)?(?:[^'";]+?\s+from\s+)?['"](\.[^'"]+)['"]/g,
  )].map((match) => match[1]);
}

function sourceCandidates(absolute) {
  const candidates = [absolute];
  if (absolute.endsWith('.js')) {
    candidates.push(`${absolute.slice(0, -3)}.ts`);
  } else if (absolute.endsWith('.mjs')) {
    candidates.push(`${absolute.slice(0, -4)}.mts`);
  } else if (absolute.endsWith('.cjs')) {
    candidates.push(`${absolute.slice(0, -4)}.cts`);
  } else {
    candidates.push(
      ...SOURCE_EXTENSIONS.map((extension) => `${absolute}${extension}`),
      ...SOURCE_EXTENSIONS.map((extension) => join(absolute, `index${extension}`)),
    );
  }
  return candidates;
}

function resolveProjectImport(root, sourceFile, specifier) {
  const absolute = resolve(dirname(join(root, sourceFile)), specifier);
  const target = sourceCandidates(absolute).find((candidate) => existsSync(candidate)) ?? absolute;
  return normalize(relative(root, target));
}

function matchesPrefix(path, prefix) {
  return prefix.endsWith('/') ? path.startsWith(prefix) : path === prefix;
}

export function checkArchitecture(root) {
  const violations = [];

  const sourceFiles = SOURCE_DIRECTORIES.flatMap((directory) =>
    collectSourceFiles(root, directory),
  );

  for (const sourceFile of sourceFiles) {
    const source = readFileSync(join(root, sourceFile), 'utf8');
    for (const specifier of importSpecifiers(source)) {
      const target = resolveProjectImport(root, sourceFile, specifier);
      for (const rule of RULES) {
        if (!sourceFile.startsWith(rule.from) || rule.allow?.includes(sourceFile)) {
          continue;
        }
        const targetAllowed = rule.allowTargets?.some((prefix) =>
          matchesPrefix(target, prefix),
        );
        if (!targetAllowed && rule.forbidden.some((prefix) => matchesPrefix(target, prefix))) {
          violations.push(`${sourceFile} -> ${target} violates ${rule.name}`);
        }
      }
    }
  }

  return violations;
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const violations = checkArchitecture(REPO_ROOT);
  for (const violation of violations) {
    process.stderr.write(`${violation}\n`);
  }
  if (violations.length > 0) {
    process.exitCode = 1;
  }
}
