import { describe, expect, it } from 'vitest';

import type { Deck } from './deck.ts';
import { decodeDecks, encodeDecks } from './deckStorage.ts';

const FULL: Deck = {
  id: 'full',
  name: 'Rand and friends',
  updatedAt: '2026-09-13T12:00:00.000Z',
  entries: [
    { cardId: '04-002_mat_cauthon_(ii)', count: 1 },
    { cardId: '01-001_a', count: 3 },
  ],
  startingCharacterId: '04-002_mat_cauthon_(ii)',
  startingHandIds: ['01-001_a'],
  startingAdvantageId: '03-124_sweat_tents',
  faceDownDragonRebornId: '01-205_rand_althor_(i)',
};

const BARE: Deck = {
  id: 'bare',
  name: '',
  updatedAt: '2026-09-13T11:00:00.000Z',
  entries: [],
  startingHandIds: [],
};

/**
 * Decode a document and return its error, failing the test if it decodes.
 *
 * @param document - The document to encode as JSON.
 * @returns The error message.
 */
function errorFor(document: unknown): string {
  const result = decodeDecks(JSON.stringify(document));
  if (result.ok) {
    throw new Error('expected decoding to fail');
  }
  return result.error;
}

describe('decodeDecks', () => {
  it('reads nothing saved as no decks', () => {
    expect(decodeDecks(undefined)).toEqual({ ok: true, decks: [] });
  });

  it('round-trips decks with and without optional choices', () => {
    expect(decodeDecks(encodeDecks([FULL, BARE]))).toEqual({ ok: true, decks: [FULL, BARE] });
  });

  it('rejects text that is not JSON', () => {
    expect(decodeDecks('{not json')).toEqual({ ok: false, error: 'document: not valid JSON' });
  });

  it('rejects another format version', () => {
    expect(errorFor({ version: 2, decks: [] })).toBe('version: expected 1');
  });

  it('reports where a deck goes wrong', () => {
    expect(errorFor({ version: 1, decks: [BARE, { ...BARE, id: 'b', name: 7 }] })).toBe(
      'decks[1].name: expected a string',
    );
    expect(
      errorFor({ version: 1, decks: [{ ...BARE, entries: [{ cardId: 'a', count: 0 }] }] }),
    ).toBe('decks[0].entries[0].count: expected a whole number of at least 1');
    expect(errorFor({ version: 1, decks: [{ ...BARE, startingCharacterId: '' }] })).toBe(
      'decks[0].startingCharacterId: expected a non-empty string',
    );
  });

  it('rejects repeated card entries and deck ids', () => {
    const repeated = {
      ...BARE,
      entries: [
        { cardId: 'a', count: 1 },
        { cardId: 'a', count: 2 },
      ],
    };
    expect(errorFor({ version: 1, decks: [repeated] })).toBe(
      'decks[0].entries[1].cardId: a appears more than once',
    );
    expect(errorFor({ version: 1, decks: [BARE, BARE] })).toBe(
      'decks[1].id: bare appears more than once',
    );
  });
});
