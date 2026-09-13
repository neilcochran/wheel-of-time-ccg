/**
 * The card browser's filter: what it holds, how it round-trips through the
 * URL, and how it selects cards.
 *
 * The URL is the source of truth so a filtered view can be bookmarked and
 * shared. Every facet is a repeatable query parameter, and values the
 * vocabularies do not recognise are dropped on parse rather than kept as
 * strings that could never match.
 */

import { ALLEGIANCES, CARD_SET_IDS, CARD_TYPES, RARITY_CLASSES, TRAITS } from '@wot/cards';
import type { Allegiance, Card, CardSetId, CardType, RarityClass, Trait } from '@wot/cards';

/** Orderings the browser offers. */
export const CARD_SORTS = ['collector', 'name'] as const;

/** How the matched cards are ordered. `collector` is set then collector number. */
export type CardSort = (typeof CARD_SORTS)[number];

/** Every facet of the card browser's filter. */
export interface CardFilter {
  /** Free text matched against name, rules text, flavour text, traits and allegiances. */
  readonly query: string;
  /** Sets to include. Empty means all. */
  readonly sets: readonly CardSetId[];
  /** Card types to include. Empty means all. */
  readonly types: readonly CardType[];
  /** Allegiances to include; a card matches if it has any of them. Empty means all. */
  readonly allegiances: readonly Allegiance[];
  /** Rarity classes to include. Empty means all. */
  readonly rarities: readonly RarityClass[];
  /** Traits to include; a card matches if it has any of them. Empty means all. */
  readonly traits: readonly Trait[];
  /** Ordering of the result. */
  readonly sort: CardSort;
}

/** The filter that matches every card. */
export const EMPTY_FILTER: CardFilter = {
  query: '',
  sets: [],
  types: [],
  allegiances: [],
  rarities: [],
  traits: [],
  sort: 'collector',
};

/** Query parameter names, one per facet. */
const PARAM_NAMES = {
  query: 'q',
  sets: 'set',
  types: 'type',
  allegiances: 'allegiance',
  rarities: 'rarity',
  traits: 'trait',
  sort: 'sort',
} as const;

/**
 * Keep the raw values a vocabulary recognises, in order and without repeats.
 *
 * @param vocabulary - The permitted values.
 * @param raw - Values as they arrived from the URL.
 * @returns The recognised values.
 */
function pickKnown<T extends string>(vocabulary: readonly T[], raw: readonly string[]): T[] {
  const known: T[] = [];
  for (const value of raw) {
    const match = vocabulary.find((candidate) => candidate === value);
    if (match !== undefined && !known.includes(match)) {
      known.push(match);
    }
  }
  return known;
}

/**
 * Interpret a sort name, falling back to collector order.
 *
 * @param value - The raw sort name.
 * @returns The sort.
 */
export function parseCardSort(value: string): CardSort {
  return pickKnown(CARD_SORTS, [value])[0] ?? 'collector';
}

/**
 * Read a filter from URL query parameters.
 *
 * @param params - The current query parameters.
 * @returns The filter they describe, with unrecognised values dropped.
 */
export function parseCardFilter(params: URLSearchParams): CardFilter {
  return {
    query: params.get(PARAM_NAMES.query) ?? '',
    sets: pickKnown(CARD_SET_IDS, params.getAll(PARAM_NAMES.sets)),
    types: pickKnown(CARD_TYPES, params.getAll(PARAM_NAMES.types)),
    allegiances: pickKnown(ALLEGIANCES, params.getAll(PARAM_NAMES.allegiances)),
    rarities: pickKnown(RARITY_CLASSES, params.getAll(PARAM_NAMES.rarities)),
    traits: pickKnown(TRAITS, params.getAll(PARAM_NAMES.traits)),
    sort: parseCardSort(params.get(PARAM_NAMES.sort) ?? ''),
  };
}

/**
 * Write a filter as URL query parameters, omitting anything at its default.
 *
 * @param filter - The filter.
 * @returns Query parameters that {@link parseCardFilter} reads back to the same filter.
 */
export function toSearchParams(filter: CardFilter): URLSearchParams {
  const params = new URLSearchParams();
  if (filter.query !== '') {
    params.set(PARAM_NAMES.query, filter.query);
  }
  for (const set of filter.sets) {
    params.append(PARAM_NAMES.sets, set);
  }
  for (const type of filter.types) {
    params.append(PARAM_NAMES.types, type);
  }
  for (const allegiance of filter.allegiances) {
    params.append(PARAM_NAMES.allegiances, allegiance);
  }
  for (const rarity of filter.rarities) {
    params.append(PARAM_NAMES.rarities, rarity);
  }
  for (const trait of filter.traits) {
    params.append(PARAM_NAMES.traits, trait);
  }
  if (filter.sort !== 'collector') {
    params.set(PARAM_NAMES.sort, filter.sort);
  }
  return params;
}

/**
 * Whether a filter narrows the card pool at all. Sort order does not count.
 *
 * @param filter - The filter.
 * @returns True when every facet is at its default.
 */
export function isEmptyFilter(filter: CardFilter): boolean {
  return (
    filter.query.trim() === '' &&
    filter.sets.length === 0 &&
    filter.types.length === 0 &&
    filter.allegiances.length === 0 &&
    filter.rarities.length === 0 &&
    filter.traits.length === 0
  );
}

/**
 * Whether a card's text mentions a lower-cased needle.
 *
 * @param card - The card.
 * @param needle - Lower-cased search text.
 * @returns True on a match in the name, rules, flavour, traits or allegiances.
 */
function matchesQuery(card: Card, needle: string): boolean {
  const haystack = [
    card.name,
    card.effect ?? '',
    card.lore ?? '',
    ...card.traits,
    ...card.allegiances,
  ]
    .join('\n')
    .toLowerCase();
  return haystack.includes(needle);
}

/**
 * Order two cards by set then collector number.
 *
 * @param a - First card.
 * @param b - Second card.
 * @returns Negative, zero or positive as a sorts before, with or after b.
 */
function compareCollector(a: Card, b: Card): number {
  if (a.setId !== b.setId) {
    return CARD_SET_IDS.indexOf(a.setId) - CARD_SET_IDS.indexOf(b.setId);
  }
  return a.collectorNumber - b.collectorNumber;
}

/**
 * Select and order the cards a filter matches.
 *
 * @param cards - The full card pool, in set then collector order.
 * @param filter - The filter to apply.
 * @returns The matching cards in the filter's sort order.
 */
export function filterCards(cards: readonly Card[], filter: CardFilter): Card[] {
  const needle = filter.query.trim().toLowerCase();
  const matched = cards.filter(
    (card) =>
      (filter.sets.length === 0 || filter.sets.includes(card.setId)) &&
      (filter.types.length === 0 || filter.types.includes(card.type)) &&
      (filter.rarities.length === 0 || filter.rarities.includes(card.rarity.class)) &&
      (filter.allegiances.length === 0 ||
        filter.allegiances.some((allegiance) => card.allegiances.includes(allegiance))) &&
      (filter.traits.length === 0 || filter.traits.some((trait) => card.traits.includes(trait))) &&
      (needle === '' || matchesQuery(card, needle)),
  );
  if (filter.sort === 'name') {
    matched.sort((a, b) => a.name.localeCompare(b.name, 'en') || compareCollector(a, b));
  }
  return matched;
}
