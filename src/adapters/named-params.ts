const NAMED_PARAM_BODY = /^[A-Za-z0-9_]+/;
const DOLLAR_QUOTE_TAG = /^\$([A-Za-z0-9_]*)\$/;

// The three quoting styles the type layer accepts (standard, MySQL, SQL
// Server). Their bodies are names, not SQL, so a `@`/`$`/`?` inside one is not
// a placeholder.
const IDENTIFIER_QUOTE_CLOSERS: ReadonlyMap<string, string> = new Map([
  ['"', '"'],
  ['`', '`'],
  ['[', ']'],
]);

// Doubling (`''`) is the only escape this scanner honours, because the only
// two adapters that use it - mssql and node:sqlite - run on engines where a
// backslash is an ordinary character: `'C:\'` is a *complete* literal in both
// T-SQL and SQLite. Treating that closing quote as escaped (MySQL's `\'`, the
// rule this scanner used to apply to every dialect) ran the literal on to the
// end of the statement and swallowed every parameter after it - silently
// wrong rows on SQLite, an unbound @name on SQL Server (issue #248).
//
// The type-level masking in src/string.ts keeps the backslash rule: it has no
// dialect to key off, and dropping it there would break the MySQL queries it
// covers today.
function skipSingleQuotedLiteral(sql: string, openIndex: number): number {
  let index = openIndex + 1;

  while (index < sql.length) {
    if (sql[index] === "'") {
      if (sql[index + 1] === "'") {
        index += 2;
        continue;
      }
      return index + 1;
    }
    index += 1;
  }

  return sql.length;
}

function skipDollarQuotedBody(sql: string, openIndex: number): number {
  const open = DOLLAR_QUOTE_TAG.exec(sql.slice(openIndex));
  if (!open) {
    return -1;
  }

  const closer = `$${open[1]}$`;
  const closeIndex = sql.indexOf(closer, openIndex + open[0].length);
  return closeIndex === -1 ? sql.length : closeIndex + closer.length;
}

// Returns the index just past the non-SQL region opening at `index`, or -1 when
// nothing opens there. Everything the type-level Normalize strips or masks
// before computing Params<DB, Q> has to be skipped here too, or the two layers
// disagree on how many placeholders a query has - comments were the gap, and
// since binding is positional, one `@word` in a comment shifted every value
// after it (issue #234).
function skipNonParameterRegion(sql: string, index: number): number {
  const char = sql[index];

  if (char === "'") {
    return skipSingleQuotedLiteral(sql, index);
  }

  if (char === '-' && sql[index + 1] === '-') {
    const newline = sql.indexOf('\n', index + 2);
    return newline === -1 ? sql.length : newline + 1;
  }

  if (char === '/' && sql[index + 1] === '*') {
    const close = sql.indexOf('*/', index + 2);
    return close === -1 ? sql.length : close + 2;
  }

  if (char === '$') {
    return skipDollarQuotedBody(sql, index);
  }

  const closer = char === undefined ? undefined : IDENTIFIER_QUOTE_CLOSERS.get(char);
  if (closer !== undefined) {
    const close = sql.indexOf(closer, index + 1);
    return close === -1 ? sql.length : close + 1;
  }

  return -1;
}

type ParameterToken = { kind: 'positional' } | { kind: 'named'; name: string };

function scanParameters(
  sql: string,
  prefixes: ReadonlySet<string>,
  visit: (token: ParameterToken) => void,
): void {
  let index = 0;

  while (index < sql.length) {
    const skipTo = skipNonParameterRegion(sql, index);
    if (skipTo !== -1) {
      index = skipTo;
      continue;
    }

    const char = sql[index] as string;

    if (char === '?') {
      visit({ kind: 'positional' });
      index += 1;
      continue;
    }

    if (prefixes.has(char)) {
      if (sql[index + 1] === char) {
        index += 2;
        continue;
      }

      const body = NAMED_PARAM_BODY.exec(sql.slice(index + 1));
      if (body) {
        visit({ kind: 'named', name: `${char}${body[0]}` });
        index += 1 + body[0].length;
        continue;
      }
    }

    index += 1;
  }
}

export function collectNamedParameters(sql: string, prefixes: ReadonlySet<string>): string[] {
  const names: string[] = [];

  scanParameters(sql, prefixes, (token) => {
    if (token.kind === 'named' && !names.includes(token.name)) {
      names.push(token.name);
    }
  });

  return names;
}

export interface MixedParameters {
  named: Record<string, unknown>;
  positional: unknown[];
}

// Params<DB, Q> types one tuple slot per placeholder in first-occurrence
// order, with repeated named placeholders (@id, $id, ...) deduped to their
// first slot - matching collectNamedParameters' own dedup. A bare `?` is
// never deduped: each occurrence consumes its own slot. This walks the SQL
// once, in that same order, so `values` (built from that tuple) is
// partitioned back into a named bag and an ordered positional list.
export function resolveMixedParameters(
  sql: string,
  prefixes: ReadonlySet<string>,
  values: readonly unknown[],
): MixedParameters {
  const named: Record<string, unknown> = {};
  const bound = new Set<string>();
  const positional: unknown[] = [];
  let valueIndex = 0;

  scanParameters(sql, prefixes, (token) => {
    if (token.kind === 'positional') {
      positional.push(values[valueIndex] ?? null);
      valueIndex += 1;
      return;
    }

    if (bound.has(token.name)) {
      return;
    }

    bound.add(token.name);
    named[token.name] = values[valueIndex] ?? null;
    valueIndex += 1;
  });

  return { named, positional };
}
