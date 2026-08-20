import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const SOURCE_EXTENSIONS = ['.ts', '.cts', '.mts'];
const SOURCE_DIRECTORIES = ['packages/core/src', 'packages/ts-plugin/src'];
const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const LAYERS = [
  { name: 'facade', prefix: 'packages/core/src/index.ts' },
  { name: 'language', prefix: 'packages/core/src/language/' },
  { name: 'schema', prefix: 'packages/core/src/schema/' },
  { name: 'compiler', prefix: 'packages/core/src/compiler/' },
  { name: 'runtime', prefix: 'packages/core/src/runtime/' },
  { name: 'adapter', prefix: 'packages/core/src/adapters/' },
  { name: 'public', prefix: 'packages/core/src/public/' },
  { name: 'tooling', prefix: 'packages/core/src/tooling/' },
  { name: 'cli', prefix: 'packages/core/src/cli/' },
  { name: 'plugin', prefix: 'packages/ts-plugin/src/' },
];

const ALLOWED_DEPENDENCIES = new Map([
  ['facade', new Set(['public'])],
  ['language', new Set(['language'])],
  ['schema', new Set(['schema'])],
  ['compiler', new Set(['compiler', 'language', 'schema'])],
  ['runtime', new Set(['runtime'])],
  ['adapter', new Set(['adapter', 'public', 'runtime', 'schema'])],
  ['public', new Set(['public', 'compiler', 'language', 'runtime', 'schema'])],
  ['tooling', new Set(['tooling', 'schema'])],
  ['cli', new Set(['cli', 'tooling'])],
  ['plugin', new Set(['plugin'])],
]);

const ALLOWED_TARGETS = new Map([
  ['plugin', new Set(['packages/core/src/compiler/analysis.ts'])],
]);

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

function importSpecifiers(source, fileName) {
  const sourceFile = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    true,
  );
  const specifiers = [];

  function addLiteral(node) {
    if (node !== undefined && ts.isStringLiteralLike(node) && node.text.startsWith('.')) {
      specifiers.push(node.text);
    }
  }

  function visit(node) {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
      addLiteral(node.moduleSpecifier);
    } else if (
      ts.isImportEqualsDeclaration(node) &&
      ts.isExternalModuleReference(node.moduleReference)
    ) {
      addLiteral(node.moduleReference.expression);
    } else if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) {
      addLiteral(node.argument.literal);
    } else if (ts.isCallExpression(node)) {
      const isDynamicImport = node.expression.kind === ts.SyntaxKind.ImportKeyword;
      const isRequire = ts.isIdentifier(node.expression) && node.expression.text === 'require';
      if (isDynamicImport || isRequire) {
        addLiteral(node.arguments[0]);
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return specifiers;
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

function layerOf(path) {
  return LAYERS.find((layer) => matchesPrefix(path, layer.prefix))?.name;
}

export function checkArchitecture(root) {
  const violations = [];

  const sourceFiles = SOURCE_DIRECTORIES.flatMap((directory) =>
    collectSourceFiles(root, directory),
  );

  for (const sourceFile of sourceFiles) {
    const source = readFileSync(join(root, sourceFile), 'utf8');
    const sourceLayer = layerOf(sourceFile);
    if (sourceLayer === undefined) {
      violations.push(`${sourceFile} is outside the declared architecture layers`);
      continue;
    }
    for (const specifier of importSpecifiers(source, sourceFile)) {
      const target = resolveProjectImport(root, sourceFile, specifier);
      const targetLayer = layerOf(target);
      const exactTargetAllowed = ALLOWED_TARGETS.get(sourceLayer)?.has(target) ?? false;
      if (exactTargetAllowed) {
        continue;
      }
      if (
        targetLayer !== undefined &&
        ALLOWED_DEPENDENCIES.get(sourceLayer)?.has(targetLayer)
      ) {
        continue;
      }
      if (target.startsWith('packages/core/src/') || target.startsWith('packages/ts-plugin/src/')) {
        violations.push(`${sourceFile} -> ${target} violates ${sourceLayer} isolation`);
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
