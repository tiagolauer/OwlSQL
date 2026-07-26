const NAMED_PARAM_BODY = /^[A-Za-z0-9_]+/;
const DOLLAR_QUOTE_TAG = /^\$([A-Za-z0-9_]*)\$/;

// A quote preceded by an odd run of backslashes is backslash-escaped (MySQL's
// and SQLite's default `\'`) and doesn't open or close a literal - the run has
// to be odd, not merely non-empty, since `\\'` is an escaped backslash followed
// by a real delimiter. Mirrors EndsWithOddBackslashes in src/string.ts and the
// same check in the ts-plugin's stripStringLiterals; without it every parameter
// after the escaped quote is read as literal body and silently dropped.
function isLiteralDelimiter(sql: string, index: number): boolean {
  let backslashes = 0;
  while (backslashes < index && sql[index - 1 - backslashes] === '\\') {
    backslashes += 1;
  }
  return backslashes % 2 === 0;
}

export function collectNamedParameters(sql: string, prefixes: ReadonlySet<string>): string[] {
  const names: string[] = [];
  let insideLiteral = false;

  for (let index = 0; index < sql.length; index += 1) {
    const char = sql[index] as string;

    if (char === "'" && isLiteralDelimiter(sql, index)) {
      insideLiteral = !insideLiteral;
      continue;
    }
    if (insideLiteral) {
      continue;
    }

    if (char === '$') {
      const open = DOLLAR_QUOTE_TAG.exec(sql.slice(index));
      if (open) {
        const closer = `$${open[1]}$`;
        const closeIndex = sql.indexOf(closer, index + open[0].length);
        index = closeIndex === -1 ? sql.length - 1 : closeIndex + closer.length - 1;
        continue;
      }
    }

    if (prefixes.has(char)) {
      if (sql[index + 1] === char) {
        index += 1;
        continue;
      }

      const body = NAMED_PARAM_BODY.exec(sql.slice(index + 1));
      if (body) {
        const name = `${char}${body[0]}`;
        if (!names.includes(name)) {
          names.push(name);
        }
        index += body[0].length;
      }
    }
  }

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
  const positional: unknown[] = [];
  let insideLiteral = false;
  let valueIndex = 0;

  for (let index = 0; index < sql.length; index += 1) {
    const char = sql[index] as string;

    if (char === "'" && isLiteralDelimiter(sql, index)) {
      insideLiteral = !insideLiteral;
      continue;
    }
    if (insideLiteral) {
      continue;
    }

    if (char === '$') {
      const open = DOLLAR_QUOTE_TAG.exec(sql.slice(index));
      if (open) {
        const closer = `$${open[1]}$`;
        const closeIndex = sql.indexOf(closer, index + open[0].length);
        index = closeIndex === -1 ? sql.length - 1 : closeIndex + closer.length - 1;
        continue;
      }
    }

    if (char === '?') {
      positional.push(values[valueIndex] ?? null);
      valueIndex += 1;
      continue;
    }

    if (prefixes.has(char)) {
      if (sql[index + 1] === char) {
        index += 1;
        continue;
      }

      const body = NAMED_PARAM_BODY.exec(sql.slice(index + 1));
      if (body) {
        const name = `${char}${body[0]}`;
        if (!(name in named)) {
          named[name] = values[valueIndex] ?? null;
          valueIndex += 1;
        }
        index += body[0].length;
      }
    }
  }

  return { named, positional };
}
