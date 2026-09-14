/**
 * The deck construction rules of the Revised 2.0 rulebook, as constants and
 * predicates over single cards.
 */

import type { Card } from '@wot/cards';

/** Fewest cards a deck may hold. */
export const MIN_DECK_SIZE = 50;

/** Most copies of any one card a deck may hold. */
export const MAX_COPIES = 3;

/** Starting hand cards besides the Starting Hero or Villain, each of a different type. */
export const STARTING_HAND_OTHER_CARDS = 3;

/** Fewest cards a tournament deck may hold. */
export const TOURNAMENT_MIN_DECK_SIZE = 60;

/** The side a deck plays, set by its Starting Hero or Villain. */
export type DeckSide = 'hero' | 'villain';

/**
 * The side a starting character leads.
 *
 * @param card - Any card.
 * @returns `hero` for a Starting Hero, `villain` for a Starting Villain, otherwise undefined.
 */
export function startingSideOf(card: Card): DeckSide | undefined {
  if (card.traits.includes('Starting Hero')) {
    return 'hero';
  }
  if (card.traits.includes('Starting Villain')) {
    return 'villain';
  }
  return undefined;
}

/**
 * Whether a card can be the face-down Dragon Reborn.
 *
 * @param card - Any card.
 * @returns True for a Starting Hero with the Dragon Reborn trait.
 */
export function isDragonRebornStartingHero(card: Card): boolean {
  return card.traits.includes('Starting Hero') && card.traits.includes('Dragon Reborn');
}

/**
 * Whether a starting character begins with a face-down Dragon Reborn.
 *
 * The rulebook names Mat Cauthon and Perrin Aybara, which are exactly the
 * Starting Heroes that are not themselves the Dragon Reborn.
 *
 * @param card - The starting character.
 * @returns True when the deck needs a face-down Dragon Reborn.
 */
export function needsFaceDownDragonReborn(card: Card): boolean {
  return card.traits.includes('Starting Hero') && !card.traits.includes('Dragon Reborn');
}

/**
 * Whether a card can begin the game in play as a Starting Advantage.
 *
 * @param card - Any card.
 * @returns True for an advantage with the Starting Advantage trait.
 */
export function isStartingAdvantage(card: Card): boolean {
  return card.type === 'Advantage' && card.traits.includes('Starting Advantage');
}

/**
 * Whether a card counts towards the tournament limit on characters and troops.
 *
 * @param card - Any card.
 * @returns True for characters and troops.
 */
export function isCharacterOrTroop(card: Card): boolean {
  return card.type === 'Character' || card.type === 'Troop';
}

/**
 * The side that may never recruit or control a card.
 *
 * @param card - Any card.
 * @returns `hero` for Dark One characters and troops, `villain` for Dragon
 *          ones, otherwise undefined.
 */
export function forbiddenSideOf(card: Card): DeckSide | undefined {
  if (!isCharacterOrTroop(card)) {
    return undefined;
  }
  if (card.allegiances.includes('Dark One')) {
    return 'hero';
  }
  if (card.allegiances.includes('Dragon')) {
    return 'villain';
  }
  return undefined;
}
