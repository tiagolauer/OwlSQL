export async function rollbackPreservingError(
  originalError: unknown,
  rollback: () => Promise<unknown>,
): Promise<void> {
  try {
    await rollback();
  } catch (rollbackError) {
    if (originalError instanceof Error && (originalError as { cause?: unknown }).cause === undefined) {
      (originalError as { cause?: unknown }).cause = rollbackError;
    }
  }
}
