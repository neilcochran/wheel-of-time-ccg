import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { decodeCardDatabase } from './database.ts';
import { CARD_SETS, TOTAL_CARD_COUNT } from './sets.ts';

/** Parse the committed database exactly as a consumer would receive it. */
function loadGenerated(): unknown {
  return JSON.parse(readFileSync(new URL('../generated/cards.json', import.meta.url), 'utf8'));
}

/** A one-set, one-card database that decodes cleanly. */
function validDatabase(): { sets: unknown[]; cards: Record<string, unknown>[] } {
  return {
    sets: [{ id: 'premiere', number: 1, name: 'Premiere', printingCount: 297 }],
    cards: [
      {
        id: '01-001_a_beginning',
        setId: 'premiere',
        collectorNumber: 1,
        name: 'A Beginning',
        type: 'Advantage',
        subtype: 'World',
        rarity: { code: 'C', class: 'Common', sheetFrequency: 2 },
        allegiances: [],
        traits: ['Unique'],
        artist: 'Someone',
        effect: 'Gain [politics].',
        abilities: { politics: {}, intrigue: {}, onePower: {}, combat: {} },
        image: '01-001_a_beginning.jpg',
        thumbnail: '01-001_a_beginning_SM.jpg',
      },
    ],
  };
}

/**
 * Build a database whose first card has been altered.
 *
 * @param mutate - Receives the first card to change in place.
 * @returns The altered database.
 */
function withFirstCard(mutate: (card: Record<string, unknown>) => void): unknown {
  const database = validDatabase();
  const card = database.cards[0];
  if (card === undefined) {
    throw new Error('fixture has no card');
  }
  mutate(card);
  return database;
}

/**
 * Decode a value expected to fail and return the reported error.
 *
 * @param value - The value to decode.
 * @returns The error message.
 */
function expectError(value: unknown): string {
  const result = decodeCardDatabase(value);
  expect(result.ok).toBe(false);
  return result.ok ? '' : result.error;
}

describe('decodeCardDatabase', () => {
  it('decodes the committed database', () => {
    const result = decodeCardDatabase(loadGenerated());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.database.cards).toHaveLength(TOTAL_CARD_COUNT);
      expect(result.database.sets).toHaveLength(CARD_SETS.length);
    }
  });

  it('keeps absent optional fields absent', () => {
    const result = decodeCardDatabase(validDatabase());
    expect(result.ok).toBe(true);
    if (result.ok) {
      const card = result.database.cards[0];
      expect(card?.subtype).toBe('World');
      expect(card?.artist).toBe('Someone');
      expect(card).not.toHaveProperty('lore');
      expect(card).not.toHaveProperty('otherPrintings');
      expect(card?.abilities.politics).toEqual({});
    }
  });

  it('rejects anything that is not an object', () => {
    expect(expectError(null)).toBe('database: expected an object');
    expect(expectError([])).toBe('database: expected an object');
  });

  it('reports the path to an unknown trait', () => {
    const error = expectError(
      withFirstCard((card) => {
        card.traits = ['Unique', 'Nonsense'];
      }),
    );
    expect(error).toContain('database.cards[0].traits[1]');
    expect(error).toContain('Nonsense');
  });

  it('rejects a rarity whose class does not match its code', () => {
    const error = expectError(
      withFirstCard((card) => {
        card.rarity = { code: 'C', class: 'Rare', sheetFrequency: 2 };
      }),
    );
    expect(error).toContain('database.cards[0].rarity');
  });

  it('rejects a sub-type on a type that cannot carry it', () => {
    const error = expectError(
      withFirstCard((card) => {
        card.type = 'Character';
      }),
    );
    expect(error).toContain('database.cards[0].subtype');
  });

  it('rejects a zero ability rating', () => {
    const error = expectError(
      withFirstCard((card) => {
        card.abilities = { politics: { ability: 0 }, intrigue: {}, onePower: {}, combat: {} };
      }),
    );
    expect(error).toContain('database.cards[0].abilities.politics.ability');
  });

  it('rejects a card in a set the database does not list', () => {
    const error = expectError(
      withFirstCard((card) => {
        card.setId = 'promo';
      }),
    );
    expect(error).toContain('no set promo');
  });

  it('rejects duplicate card ids', () => {
    const database = validDatabase();
    database.cards.push({ ...validDatabase().cards[0] });
    expect(expectError(database)).toContain('duplicate card id');
  });
});
