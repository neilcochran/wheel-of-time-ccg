/**
 * Card fixtures shared by the engine's tests.
 */

import type { Card } from '@wot/cards';

/**
 * Build a card with sensible defaults for whatever a test does not set.
 *
 * @param overrides - Fields that matter to the test.
 * @returns A complete card, an event named after its id unless told otherwise.
 */
export function makeCard(overrides: Partial<Card> & Pick<Card, 'id'>): Card {
  return {
    name: overrides.id,
    setId: 'premiere',
    collectorNumber: 1,
    type: 'Event',
    rarity: { code: 'C', class: 'Common', sheetFrequency: 2 },
    allegiances: [],
    traits: [],
    abilities: { politics: {}, intrigue: {}, onePower: {}, combat: {} },
    image: 'card.jpg',
    thumbnail: 'card_SM.jpg',
    ...overrides,
  };
}
