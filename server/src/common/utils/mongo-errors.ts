const DUPLICATE_KEY_ERROR = 11000;

/** true si Mongo rechazó la escritura por un índice único. */
export function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === DUPLICATE_KEY_ERROR
  );
}
