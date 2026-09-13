/**
 * Saved decks as they sit in local storage: one versioned JSON document
 * holding every deck.
 *
 * Decoding checks the whole shape and reports the first problem rather than
 * dropping what it cannot read. Saved decks are the player's own work, so a
 * document that fails to decode must be reported, never quietly replaced.
 */

import type { Deck, DeckEntry } from './deck.ts';

/** The local storage key holding the saved decks document. */
export const DECK_STORAGE_KEY = 'wot-ccg:decks';

/** The document format version this code reads and writes. */
export const DECK_STORAGE_VERSION = 1;

/** Outcome of decoding: the decks, or where and why decoding stopped. */
export type DecodeDecksResult =
  | {
      /** Discriminator. */
      readonly ok: true;
      /** The decoded decks, in stored order. */
      readonly decks: readonly Deck[];
    }
  | {
      /** Discriminator. */
      readonly ok: false;
      /** The first problem found, prefixed with the path to the offending value. */
      readonly error: string;
    };

/** Records the first failure so nested decoders can report where it was. */
interface DecodeContext {
  /** Path and message of the first failure, or undefined while decoding is clean. */
  error: string | undefined;
}

/**
 * Record a failure and return undefined, so a decoder can `return fail(...)`.
 *
 * @param context - Shared decode state.
 * @param path - Where in the document the bad value sits.
 * @param message - What is wrong with it.
 * @returns Always undefined.
 */
function fail(context: DecodeContext, path: string, message: string): undefined {
  context.error ??= `${path}: ${message}`;
  return undefined;
}

/**
 * Whether a value is a plain object.
 *
 * @param value - Any value.
 * @returns True for non-null, non-array objects.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Decode a required identifier.
 *
 * @param context - Shared decode state.
 * @param value - The raw value.
 * @param path - Where the value sits.
 * @returns The identifier, or undefined on failure.
 */
function decodeId(context: DecodeContext, value: unknown, path: string): string | undefined {
  if (typeof value !== 'string' || value === '') {
    return fail(context, path, 'expected a non-empty string');
  }
  return value;
}

/**
 * Decode an optional identifier. Absence is not a failure.
 *
 * @param context - Shared decode state.
 * @param value - The raw value.
 * @param path - Where the value sits.
 * @returns The identifier, or undefined when absent or on failure.
 */
function decodeOptionalId(
  context: DecodeContext,
  value: unknown,
  path: string,
): string | undefined {
  return value === undefined ? undefined : decodeId(context, value, path);
}

/**
 * Decode a list of identifiers.
 *
 * @param context - Shared decode state.
 * @param value - The raw value.
 * @param path - Where the value sits.
 * @returns The identifiers, or undefined on failure.
 */
function decodeIdList(context: DecodeContext, value: unknown, path: string): string[] | undefined {
  if (!Array.isArray(value)) {
    return fail(context, path, 'expected an array');
  }
  const items: unknown[] = value;
  const ids: string[] = [];
  for (const [index, item] of items.entries()) {
    const id = decodeId(context, item, `${path}[${index}]`);
    if (id === undefined) {
      return undefined;
    }
    ids.push(id);
  }
  return ids;
}

/**
 * Decode a deck's card entries.
 *
 * @param context - Shared decode state.
 * @param value - The raw value.
 * @param path - Where the value sits.
 * @returns The entries, or undefined on failure.
 */
function decodeEntries(
  context: DecodeContext,
  value: unknown,
  path: string,
): DeckEntry[] | undefined {
  if (!Array.isArray(value)) {
    return fail(context, path, 'expected an array');
  }
  const items: unknown[] = value;
  const entries: DeckEntry[] = [];
  const seen = new Set<string>();
  for (const [index, item] of items.entries()) {
    const itemPath = `${path}[${index}]`;
    if (!isRecord(item)) {
      return fail(context, itemPath, 'expected an object');
    }
    const cardId = decodeId(context, item.cardId, `${itemPath}.cardId`);
    if (cardId === undefined) {
      return undefined;
    }
    if (seen.has(cardId)) {
      return fail(context, `${itemPath}.cardId`, `${cardId} appears more than once`);
    }
    const count = item.count;
    if (typeof count !== 'number' || !Number.isInteger(count) || count < 1) {
      return fail(context, `${itemPath}.count`, 'expected a whole number of at least 1');
    }
    seen.add(cardId);
    entries.push({ cardId, count });
  }
  return entries;
}

/**
 * Decode one deck.
 *
 * @param context - Shared decode state.
 * @param value - The raw value.
 * @param path - Where the value sits.
 * @returns The deck, or undefined on failure.
 */
function decodeDeck(context: DecodeContext, value: unknown, path: string): Deck | undefined {
  if (!isRecord(value)) {
    return fail(context, path, 'expected an object');
  }
  const id = decodeId(context, value.id, `${path}.id`);
  const name =
    typeof value.name === 'string'
      ? value.name
      : fail(context, `${path}.name`, 'expected a string');
  const updatedAt = decodeId(context, value.updatedAt, `${path}.updatedAt`);
  const entries = decodeEntries(context, value.entries, `${path}.entries`);
  const startingHandIds = decodeIdList(context, value.startingHandIds, `${path}.startingHandIds`);
  const startingCharacterId = decodeOptionalId(
    context,
    value.startingCharacterId,
    `${path}.startingCharacterId`,
  );
  const startingAdvantageId = decodeOptionalId(
    context,
    value.startingAdvantageId,
    `${path}.startingAdvantageId`,
  );
  const faceDownDragonRebornId = decodeOptionalId(
    context,
    value.faceDownDragonRebornId,
    `${path}.faceDownDragonRebornId`,
  );
  if (
    context.error !== undefined ||
    id === undefined ||
    name === undefined ||
    updatedAt === undefined ||
    entries === undefined ||
    startingHandIds === undefined
  ) {
    return undefined;
  }
  return {
    id,
    name,
    updatedAt,
    entries,
    startingHandIds,
    ...(startingCharacterId === undefined ? {} : { startingCharacterId }),
    ...(startingAdvantageId === undefined ? {} : { startingAdvantageId }),
    ...(faceDownDragonRebornId === undefined ? {} : { faceDownDragonRebornId }),
  };
}

/**
 * Decode the whole saved decks document.
 *
 * @param context - Shared decode state.
 * @param value - The parsed JSON.
 * @returns The decks, or undefined on failure.
 */
function decodeDocument(context: DecodeContext, value: unknown): Deck[] | undefined {
  if (!isRecord(value)) {
    return fail(context, 'document', 'expected an object');
  }
  if (value.version !== DECK_STORAGE_VERSION) {
    return fail(context, 'version', `expected ${DECK_STORAGE_VERSION}`);
  }
  if (!Array.isArray(value.decks)) {
    return fail(context, 'decks', 'expected an array');
  }
  const items: unknown[] = value.decks;
  const decks: Deck[] = [];
  const ids = new Set<string>();
  for (const [index, item] of items.entries()) {
    const path = `decks[${index}]`;
    const deck = decodeDeck(context, item, path);
    if (deck === undefined) {
      return undefined;
    }
    if (ids.has(deck.id)) {
      return fail(context, `${path}.id`, `${deck.id} appears more than once`);
    }
    ids.add(deck.id);
    decks.push(deck);
  }
  return decks;
}

/**
 * Decode the saved decks document.
 *
 * @param text - The stored text, or undefined when nothing has been saved yet.
 * @returns The decks, or the reason they could not be read.
 */
export function decodeDecks(text: string | undefined): DecodeDecksResult {
  if (text === undefined) {
    return { ok: true, decks: [] };
  }
  let document: unknown;
  try {
    document = JSON.parse(text);
  } catch {
    return { ok: false, error: 'document: not valid JSON' };
  }
  const context: DecodeContext = { error: undefined };
  const decks = decodeDocument(context, document);
  if (decks === undefined) {
    return { ok: false, error: context.error ?? 'document: could not be read' };
  }
  return { ok: true, decks };
}

/**
 * Encode decks as the saved decks document.
 *
 * @param decks - Every deck to save.
 * @returns Text that {@link decodeDecks} reads back to the same decks.
 */
export function encodeDecks(decks: readonly Deck[]): string {
  return JSON.stringify({ version: DECK_STORAGE_VERSION, decks });
}
