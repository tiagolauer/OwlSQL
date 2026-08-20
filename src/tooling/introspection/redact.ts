// URL userinfo ("//user:pass@" or a mistyped single-slash ":/user:pass@"). The
// single-slash form requires a multi-character scheme before the ":/" so that
// Windows drive-letter paths ("C:/app@prod.db") are not treated as URL userinfo.
//
// The userinfo run is greedy up to the *last* "@" of the authority, because
// that is the one a URL parser splits on: an unencoded "@" inside a password
// ("root:p@ss@host") is accepted by `new URL` and by the drivers, and a
// non-greedy match stopped at the first one and printed the rest of the
// password (issue #251). "/", "?" and "#" end the authority, so a later "@"
// in a path or query is never mistaken for userinfo.
const URL_CREDENTIALS_PATTERN = /(\/\/|(?<=[a-z][a-z0-9+.-]):\/)[^/?#]*@/i;

// The password value of an ADO / DSN "Pwd="/"Password=" pair. The value may be
// wrapped in double quotes, braces, or single quotes (so an embedded ";" does
// not terminate it); an unquoted value runs to the next ";" delimiter.
const DSN_PASSWORD_PATTERN =
  /((?:^|;)\s*(?:pwd|password)\s*=)("[^"]*"|\{[^}]*\}|'[^']*'|[^;]*)/gi;

// Lives with introspection so dialect modules do not depend on schema generation.
export function redactCredentials(url: string): string {
  return url
    .replace(URL_CREDENTIALS_PATTERN, (_match, separator: string) => `${separator}***@`)
    .replace(DSN_PASSWORD_PATTERN, '$1***');
}
