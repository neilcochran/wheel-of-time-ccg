import { describe, expect, it } from 'vitest';

import type { Card } from '@wot/cards';

import {
  EMPTY_FILTER,
  filterCards,
  isEmptyFilter,
  parseCardFilter,
  parseCardSort,
  toSearchParams,
} from './filter.ts';

/**
 * Build a card with sensible defaults for whatever a test does not set.
 *
 * @param overrides - Fields that matter to the test.
 * @returns A complete card.
 */
function makeCard(overrides: Partial<Card> & Pick<Card, 'id' | 'name'>): Card {
  return {
    setId: 'premiere',
    collectorNumber: 1,
    type: 'Character',
    rarity: { code: 'C', class: 'Common', sheetFrequency: 2 },
    allegiances: [],
    traits: [],
    abilities: { politics: {}, intrigue: {}, onePower: {}, combat: {} },
    image: 'card.jpg',
    thumbnail: 'card_SM.jpg',
    ...overrides,
  };
}

const CARDS: readonly Card[] = [
  makeCard({
    id: '01-001',
    name: 'Moiraine Damodred',
    collectorNumber: 1,
    allegiances: ['Aes Sedai'],
    traits: ['Blue Ajah', 'Unique'],
    effect: 'Gain [onePower].',
  }),
  makeCard({
    id: '01-002',
    name: 'Bela',
    collectorNumber: 2,
    type: 'Advantage',
    subtype: 'Character',
    rarity: { code: 'R', class: 'Rare', sheetFrequency: 1 },
    lore: 'A shaggy mare.',
  }),
  makeCard({
    id: '02-001',
    name: 'Aginor',
    setId: 'dark_prophecies',
    collectorNumber: 1,
    allegiances: ['Dark One'],
    traits: ['Forsaken', 'Unique'],
  }),
];

describe('parseCardFilter', () => {
  it('reads every facet and drops unknown values', () => {
    const params = new URLSearchParams(
      'q=mare&set=premiere&set=nowhere&type=Advantage&allegiance=Dark%20One&rarity=Rare&trait=Unique&sort=name',
    );
    expect(parseCardFilter(params)).toEqual({
      query: 'mare',
      sets: ['premiere'],
      types: ['Advantage'],
      allegiances: ['Dark One'],
      rarities: ['Rare'],
      traits: ['Unique'],
      sort: 'name',
    });
  });

  it('gives the empty filter for no parameters', () => {
    expect(parseCardFilter(new URLSearchParams())).toEqual(EMPTY_FILTER);
  });

  it('ignores repeated values', () => {
    expect(parseCardFilter(new URLSearchParams('set=promo&set=promo')).sets).toEqual(['promo']);
  });
});

describe('toSearchParams', () => {
  it('round-trips through parseCardFilter', () => {
    const filter = {
      query: 'shaggy',
      sets: ['premiere', 'cycles'],
      types: ['Troop'],
      allegiances: ['Aiel', 'Tear'],
      rarities: ['Fixed'],
      traits: ['Wolf'],
      sort: 'name',
    } satisfies typeof EMPTY_FILTER;
    expect(parseCardFilter(toSearchParams(filter))).toEqual(filter);
  });

  it('writes nothing for the empty filter', () => {
    expect(toSearchParams(EMPTY_FILTER).toString()).toBe('');
  });
});

describe('parseCardSort', () => {
  it('falls back to collector order', () => {
    expect(parseCardSort('name')).toBe('name');
    expect(parseCardSort('sideways')).toBe('collector');
  });
});

describe('isEmptyFilter', () => {
  it('treats whitespace-only text and a sort as empty', () => {
    expect(isEmptyFilter({ ...EMPTY_FILTER, query: '  ', sort: 'name' })).toBe(true);
    expect(isEmptyFilter({ ...EMPTY_FILTER, types: ['Event'] })).toBe(false);
  });
});

describe('filterCards', () => {
  it('returns everything in collector order for the empty filter', () => {
    expect(filterCards(CARDS, EMPTY_FILTER).map((card) => card.id)).toEqual([
      '01-001',
      '01-002',
      '02-001',
    ]);
  });

  it('narrows by set, type and rarity', () => {
    expect(filterCards(CARDS, { ...EMPTY_FILTER, sets: ['dark_prophecies'] })).toHaveLength(1);
    expect(filterCards(CARDS, { ...EMPTY_FILTER, types: ['Advantage'] })).toHaveLength(1);
    expect(filterCards(CARDS, { ...EMPTY_FILTER, rarities: ['Rare'] })).toHaveLength(1);
  });

  it('matches any of the chosen allegiances or traits', () => {
    const byAllegiance = filterCards(CARDS, {
      ...EMPTY_FILTER,
      allegiances: ['Aes Sedai', 'Dark One'],
    });
    expect(byAllegiance.map((card) => card.id)).toEqual(['01-001', '02-001']);
    expect(filterCards(CARDS, { ...EMPTY_FILTER, traits: ['Forsaken'] })).toHaveLength(1);
  });

  it('searches name, rules, flavour, traits and allegiances case-insensitively', () => {
    function ids(query: string): string[] {
      return filterCards(CARDS, { ...EMPTY_FILTER, query }).map((card) => card.id);
    }
    expect(ids('MOIRAINE')).toEqual(['01-001']);
    expect(ids('onepower')).toEqual(['01-001']);
    expect(ids('shaggy')).toEqual(['01-002']);
    expect(ids('forsaken')).toEqual(['02-001']);
    expect(ids('dark one')).toEqual(['02-001']);
    expect(ids('nothing here')).toEqual([]);
  });

  it('sorts by name when asked', () => {
    expect(filterCards(CARDS, { ...EMPTY_FILTER, sort: 'name' }).map((card) => card.name)).toEqual([
      'Aginor',
      'Bela',
      'Moiraine Damodred',
    ]);
  });
});
