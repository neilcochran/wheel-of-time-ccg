/**
 * The outcome of an operation that can be refused.
 *
 * Refusals are expected, since players try moves the rules do not allow, so
 * they are values rather than exceptions.
 */

/** A value, or the reason there is none. */
export type Result<T> =
  | {
      /** Discriminator. */
      readonly ok: true;
      /** The value. */
      readonly value: T;
    }
  | {
      /** Discriminator. */
      readonly ok: false;
      /** Why the operation was refused, as a sentence for display. */
      readonly error: string;
    };

/**
 * Wrap a value as a success.
 *
 * @param value - The value.
 * @returns The success.
 */
export function ok<T>(value: T): Result<T> {
  return { ok: true, value };
}

/**
 * Build a refusal.
 *
 * @param error - Why, as a sentence for display.
 * @returns The refusal.
 */
export function fail<T>(error: string): Result<T> {
  return { ok: false, error };
}
