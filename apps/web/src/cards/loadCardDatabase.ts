import { decodeCardDatabase } from '@wot/cards';
import type { DecodeCardDatabaseResult } from '@wot/cards';
import generated from '@wot/cards/generated';

/** The decode result, computed once per page load. */
let cached: DecodeCardDatabaseResult | undefined;

/**
 * Decode the bundled card database.
 *
 * The JSON ships inside the bundle, so there is nothing to fetch. Decoding
 * once and remembering the outcome keeps a failure visible on every render
 * without repeating the work.
 *
 * @returns The database, or the reason it could not be decoded.
 */
export function loadCardDatabase(): DecodeCardDatabaseResult {
  cached ??= decodeCardDatabase(generated);
  return cached;
}
