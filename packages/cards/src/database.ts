/**
 * Decoder for the generated card database.
 *
 * `generated/cards.json` is written by the importer from validated source
 * data, but importing JSON only tells TypeScript the shape of the file, with
 * every closed vocabulary widened to `string`. Decoding at load time gives the
 * consumer a {@link CardDatabase} whose unions are real, and turns a stale or
 * hand-edited file into a reported error rather than a failure somewhere
 * downstream.
 */

import { toCardRarity } from './rarity.ts';
import {
  ALLEGIANCES,
  CARD_SET_IDS,
  CARD_SUBTYPES,
  CARD_TYPES,
  RARITY_CODES,
  SUBTYPES_BY_CARD_TYPE,
  TRAITS,
} from './types.ts';
import type {
  AbilityRating,
  AbilityTrack,
  Card,
  CardDatabase,
  CardPrinting,
  CardRarity,
  CardSet,
  CardSubtype,
} from './types.ts';

/** Outcome of decoding: the database, or where and why decoding stopped. */
export type DecodeCardDatabaseResult =
  | {
      /** Discriminator. */
      readonly ok: true;
      /** The decoded database. */
      readonly database: CardDatabase;
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
 * Only the first failure is kept: everything after it is a consequence of the
 * same bad file and would only add noise.
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
 * Decode a plain object.
 *
 * @param context - Shared decode state.
 * @param value - The value to decode.
 * @param path - Where the value sits.
 * @returns The object, or undefined after recording a failure.
 */
function decodeRecord(
  context: DecodeContext,
  value: unknown,
  path: string,
): Record<string, unknown> | undefined {
  return isRecord(value) ? value : fail(context, path, 'expected an object');
}

/**
 * Decode a string.
 *
 * @param context - Shared decode state.
 * @param value - The value to decode.
 * @param path - Where the value sits.
 * @returns The string, or undefined after recording a failure.
 */
function decodeString(context: DecodeContext, value: unknown, path: string): string | undefined {
  return typeof value === 'string' ? value : fail(context, path, 'expected a string');
}

/**
 * Decode an integer no smaller than a floor.
 *
 * @param context - Shared decode state.
 * @param value - The value to decode.
 * @param path - Where the value sits.
 * @param minimum - Smallest acceptable value.
 * @returns The integer, or undefined after recording a failure.
 */
function decodeInteger(
  context: DecodeContext,
  value: unknown,
  path: string,
  minimum: number,
): number | undefined {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < minimum) {
    return fail(context, path, `expected an integer of at least ${minimum}`);
  }
  return value;
}

/**
 * Decode a value that must be one of a closed vocabulary.
 *
 * @param context - Shared decode state.
 * @param vocabulary - The permitted values.
 * @param value - The value to decode.
 * @param path - Where the value sits.
 * @returns The value, narrowed, or undefined after recording a failure.
 */
function decodeOneOf<T extends string>(
  context: DecodeContext,
  vocabulary: readonly T[],
  value: unknown,
  path: string,
): T | undefined {
  const match = vocabulary.find((candidate) => candidate === value);
  return match ?? fail(context, path, `unknown value ${JSON.stringify(value)}`);
}

/**
 * Decode an array, applying an item decoder to each element.
 *
 * @param context - Shared decode state.
 * @param value - The value to decode.
 * @param path - Where the value sits.
 * @param decodeItem - Decodes one element given its value and path.
 * @returns The decoded items, or undefined after recording a failure.
 */
function decodeArray<T>(
  context: DecodeContext,
  value: unknown,
  path: string,
  decodeItem: (item: unknown, itemPath: string) => T | undefined,
): T[] | undefined {
  if (!Array.isArray(value)) {
    return fail(context, path, 'expected an array');
  }
  const items: T[] = [];
  for (const [index, item] of value.entries()) {
    const decoded = decodeItem(item, `${path}[${index}]`);
    if (decoded === undefined) {
      return undefined;
    }
    items.push(decoded);
  }
  return items;
}

/**
 * Decode a published set.
 *
 * @param context - Shared decode state.
 * @param value - The value to decode.
 * @param path - Where the value sits.
 * @returns The set, or undefined after recording a failure.
 */
function decodeCardSet(context: DecodeContext, value: unknown, path: string): CardSet | undefined {
  const record = decodeRecord(context, value, path);
  if (record === undefined) {
    return undefined;
  }
  const id = decodeOneOf(context, CARD_SET_IDS, record.id, `${path}.id`);
  const number = decodeInteger(context, record.number, `${path}.number`, 0);
  const name = decodeString(context, record.name, `${path}.name`);
  const printingCount = decodeInteger(context, record.printingCount, `${path}.printingCount`, 1);
  if (
    id === undefined ||
    number === undefined ||
    name === undefined ||
    printingCount === undefined
  ) {
    return undefined;
  }
  return { id, number, name, printingCount };
}

/**
 * Decode a rarity, checking that its class and frequency match its code.
 *
 * @param context - Shared decode state.
 * @param value - The value to decode.
 * @param path - Where the value sits.
 * @returns The rarity, or undefined after recording a failure.
 */
function decodeRarity(
  context: DecodeContext,
  value: unknown,
  path: string,
): CardRarity | undefined {
  const record = decodeRecord(context, value, path);
  if (record === undefined) {
    return undefined;
  }
  const code = decodeOneOf(context, RARITY_CODES, record.code, `${path}.code`);
  if (code === undefined) {
    return undefined;
  }
  const expected = toCardRarity(code);
  if (record.class !== expected.class || record.sheetFrequency !== expected.sheetFrequency) {
    return fail(context, path, `class and sheet frequency do not match code ${code}`);
  }
  return expected;
}

/**
 * Decode one ability track's rating.
 *
 * @param context - Shared decode state.
 * @param value - The value to decode.
 * @param path - Where the value sits.
 * @returns The rating, or undefined after recording a failure.
 */
function decodeAbilityRating(
  context: DecodeContext,
  value: unknown,
  path: string,
): AbilityRating | undefined {
  const record = decodeRecord(context, value, path);
  if (record === undefined) {
    return undefined;
  }
  const rating: { ability?: number; cost?: number } = {};
  if (record.ability !== undefined) {
    const ability = decodeInteger(context, record.ability, `${path}.ability`, 1);
    if (ability === undefined) {
      return undefined;
    }
    rating.ability = ability;
  }
  if (record.cost !== undefined) {
    const cost = decodeInteger(context, record.cost, `${path}.cost`, 1);
    if (cost === undefined) {
      return undefined;
    }
    rating.cost = cost;
  }
  return rating;
}

/**
 * Decode the four ability tracks.
 *
 * @param context - Shared decode state.
 * @param value - The value to decode.
 * @param path - Where the value sits.
 * @returns The ratings keyed by track, or undefined after recording a failure.
 */
function decodeAbilities(
  context: DecodeContext,
  value: unknown,
  path: string,
): Readonly<Record<AbilityTrack, AbilityRating>> | undefined {
  const record = decodeRecord(context, value, path);
  if (record === undefined) {
    return undefined;
  }
  const politics = decodeAbilityRating(context, record.politics, `${path}.politics`);
  const intrigue = decodeAbilityRating(context, record.intrigue, `${path}.intrigue`);
  const onePower = decodeAbilityRating(context, record.onePower, `${path}.onePower`);
  const combat = decodeAbilityRating(context, record.combat, `${path}.combat`);
  if (
    politics === undefined ||
    intrigue === undefined ||
    onePower === undefined ||
    combat === undefined
  ) {
    return undefined;
  }
  return { politics, intrigue, onePower, combat };
}

/**
 * Decode an alternative printing.
 *
 * @param context - Shared decode state.
 * @param value - The value to decode.
 * @param path - Where the value sits.
 * @returns The printing, or undefined after recording a failure.
 */
function decodePrinting(
  context: DecodeContext,
  value: unknown,
  path: string,
): CardPrinting | undefined {
  const record = decodeRecord(context, value, path);
  if (record === undefined) {
    return undefined;
  }
  const name = decodeString(context, record.name, `${path}.name`);
  const image = decodeString(context, record.image, `${path}.image`);
  const thumbnail = decodeString(context, record.thumbnail, `${path}.thumbnail`);
  const note = decodeString(context, record.note, `${path}.note`);
  if (name === undefined || image === undefined || thumbnail === undefined || note === undefined) {
    return undefined;
  }
  return { name, image, thumbnail, note };
}

/**
 * Decode a card.
 *
 * @param context - Shared decode state.
 * @param value - The value to decode.
 * @param path - Where the value sits.
 * @returns The card, or undefined after recording a failure.
 */
function decodeCard(context: DecodeContext, value: unknown, path: string): Card | undefined {
  const record = decodeRecord(context, value, path);
  if (record === undefined) {
    return undefined;
  }

  const id = decodeString(context, record.id, `${path}.id`);
  const setId = decodeOneOf(context, CARD_SET_IDS, record.setId, `${path}.setId`);
  const collectorNumber = decodeInteger(
    context,
    record.collectorNumber,
    `${path}.collectorNumber`,
    0,
  );
  const name = decodeString(context, record.name, `${path}.name`);
  const type = decodeOneOf(context, CARD_TYPES, record.type, `${path}.type`);
  const rarity = decodeRarity(context, record.rarity, `${path}.rarity`);
  const allegiances = decodeArray(
    context,
    record.allegiances,
    `${path}.allegiances`,
    (item, itemPath) => decodeOneOf(context, ALLEGIANCES, item, itemPath),
  );
  const traits = decodeArray(context, record.traits, `${path}.traits`, (item, itemPath) =>
    decodeOneOf(context, TRAITS, item, itemPath),
  );
  const abilities = decodeAbilities(context, record.abilities, `${path}.abilities`);
  const image = decodeString(context, record.image, `${path}.image`);
  const thumbnail = decodeString(context, record.thumbnail, `${path}.thumbnail`);
  if (
    id === undefined ||
    setId === undefined ||
    collectorNumber === undefined ||
    name === undefined ||
    type === undefined ||
    rarity === undefined ||
    allegiances === undefined ||
    traits === undefined ||
    abilities === undefined ||
    image === undefined ||
    thumbnail === undefined
  ) {
    return undefined;
  }

  let subtype: CardSubtype | undefined;
  if (record.subtype !== undefined) {
    subtype = decodeOneOf(context, CARD_SUBTYPES, record.subtype, `${path}.subtype`);
    if (subtype === undefined) {
      return undefined;
    }
    if (!(SUBTYPES_BY_CARD_TYPE[type]?.includes(subtype) ?? false)) {
      return fail(context, `${path}.subtype`, `${type} cards cannot carry sub-type ${subtype}`);
    }
  }

  const optionalText: { artist?: string; effect?: string; lore?: string } = {};
  for (const key of ['artist', 'effect', 'lore'] as const) {
    if (record[key] !== undefined) {
      const text = decodeString(context, record[key], `${path}.${key}`);
      if (text === undefined) {
        return undefined;
      }
      optionalText[key] = text;
    }
  }

  let otherPrintings: CardPrinting[] | undefined;
  if (record.otherPrintings !== undefined) {
    otherPrintings = decodeArray(
      context,
      record.otherPrintings,
      `${path}.otherPrintings`,
      (item, itemPath) => decodePrinting(context, item, itemPath),
    );
    if (otherPrintings === undefined) {
      return undefined;
    }
  }

  return {
    id,
    setId,
    collectorNumber,
    name,
    type,
    ...(subtype === undefined ? {} : { subtype }),
    rarity,
    allegiances,
    traits,
    ...optionalText,
    abilities,
    image,
    thumbnail,
    ...(otherPrintings === undefined ? {} : { otherPrintings }),
  };
}

/**
 * Decode the generated card database from parsed JSON.
 *
 * Beyond the shape of each value, this checks that every card belongs to a
 * listed set and that no two cards share an id, since consumers index on both.
 *
 * @param value - The parsed contents of `generated/cards.json`.
 * @returns The database, or the first problem found.
 */
export function decodeCardDatabase(value: unknown): DecodeCardDatabaseResult {
  const context: DecodeContext = { error: undefined };

  const root = decodeRecord(context, value, 'database');
  const sets =
    root === undefined
      ? undefined
      : decodeArray(context, root.sets, 'database.sets', (item, itemPath) =>
          decodeCardSet(context, item, itemPath),
        );
  const cards =
    root === undefined
      ? undefined
      : decodeArray(context, root.cards, 'database.cards', (item, itemPath) =>
          decodeCard(context, item, itemPath),
        );

  if (sets !== undefined && cards !== undefined) {
    const setIds = new Set(sets.map((set) => set.id));
    const cardIds = new Set<string>();
    for (const [index, card] of cards.entries()) {
      if (!setIds.has(card.setId)) {
        fail(context, `database.cards[${index}].setId`, `no set ${card.setId} in database.sets`);
        break;
      }
      if (cardIds.has(card.id)) {
        fail(context, `database.cards[${index}].id`, `duplicate card id ${card.id}`);
        break;
      }
      cardIds.add(card.id);
    }
  }

  if (context.error !== undefined || sets === undefined || cards === undefined) {
    return { ok: false, error: context.error ?? 'database: decoding failed' };
  }
  return { ok: true, database: { sets, cards } };
}
