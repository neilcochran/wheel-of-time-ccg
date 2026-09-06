import type { CardSet, CardSetId } from './types.ts';

/**
 * The five published card sets.
 *
 * Set numbers are the ones the printed collector numbers use, and they are the
 * first component of every card id. Card counts are asserted by the importer.
 */
export const CARD_SETS: readonly CardSet[] = [
  { id: 'promo', number: 0, name: 'Promo', printingCount: 11 },
  { id: 'premiere', number: 1, name: 'Premiere', printingCount: 297 },
  { id: 'dark_prophecies', number: 2, name: 'Dark Prophecies', printingCount: 151 },
  { id: 'children_of_the_dragon', number: 3, name: 'Children of the Dragon', printingCount: 154 },
  { id: 'cycles', number: 4, name: 'Cycles', printingCount: 4 },
];

/**
 * Total pieces of cardboard across all five sets, and the number of card scans.
 *
 * This is the figure every official rarity list and collector checklist gives.
 */
export const TOTAL_PRINTING_COUNT = 617;

/**
 * Total distinct cards across all five sets.
 *
 * One fewer than the printing count, because Dark Prophecies catalogued the
 * misprinted `Jarette Byar` separately from its corrected reprint `Jaret Byar`
 * and they are the same card.
 */
export const TOTAL_CARD_COUNT = 616;

/**
 * Look up a set by its identifier.
 *
 * @param id - The set identifier.
 * @returns The set, or `undefined` if no set has that identifier.
 */
export function getCardSet(id: CardSetId): CardSet | undefined {
  return CARD_SETS.find((set) => set.id === id);
}

/**
 * Look up a set by its set number.
 *
 * @param setNumber - The set number, 0 through 4.
 * @returns The set, or `undefined` if no set has that number.
 */
export function getCardSetByNumber(setNumber: number): CardSet | undefined {
  return CARD_SETS.find((set) => set.number === setNumber);
}
