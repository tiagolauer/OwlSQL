// A rollback that fails must not replace the failure that caused it. The
// original error is what explains why the transaction was abandoned; a
// cleanup failure on top of it ("Transaction has not begun", a dead
// connection) sends the reader looking in the wrong place entirely.
//
// When the rollback succeeds the original error propagates untouched. When it
// fails both are surfaced as an AggregateError with the original first, so
// `errors[0]` is always the real cause - formatCliError in src/cli/index.ts
// already unwraps AggregateError, so there is precedent for the shape.
export async function rollbackAndRethrow(
  error: unknown,
  rollback: () => Promise<unknown>,
): Promise<never> {
  try {
    await rollback();
  } catch (rollbackError) {
    throw new AggregateError(
      [error, rollbackError],
      'The transaction failed and rolling it back failed too.',
    );
  }

  throw error;
}
