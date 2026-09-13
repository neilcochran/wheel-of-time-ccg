/**
 * Deck legality under the Revised 2.0 rulebook.
 *
 * A report has three tiers. Errors break the rules every deck must follow, so
 * a deck with any cannot be played. Warnings mark cards that are legal to
 * include but that this deck can never put into play. Tournament problems
 * break only the additional tournament rules, which the rulebook encourages
 * everywhere but does not require.
 */

import type { Card } from '@wot/cards';

import { copiesOf, deckSize } from './deck.ts';
import type { Deck } from './deck.ts';
import {
  MAX_COPIES,
  MIN_DECK_SIZE,
  STARTING_HAND_OTHER_CARDS,
  TOURNAMENT_MIN_DECK_SIZE,
  forbiddenSideOf,
  isCharacterOrTroop,
  isDragonRebornStartingHero,
  isStartingAdvantage,
  needsFaceDownDragonReborn,
  startingSideOf,
} from './rules.ts';
import type { DeckSide } from './rules.ts';

/** What a deck issue is about, for code that needs more than the message. */
export type DeckIssueCode =
  | 'unknown-card'
  | 'too-few-cards'
  | 'too-many-copies'
  | 'no-starting-character'
  | 'not-a-starting-character'
  | 'starting-hand-not-in-deck'
  | 'starting-hand-size'
  | 'starting-hand-types'
  | 'face-down-dragon-reborn-missing'
  | 'face-down-dragon-reborn-invalid'
  | 'face-down-dragon-reborn-unused'
  | 'not-a-starting-advantage'
  | 'unrecruitable-starting-character'
  | 'unrecruitable-allegiance'
  | 'tournament-too-few-cards'
  | 'tournament-too-many-characters-and-troops';

/** One problem with a deck. */
export interface DeckIssue {
  /** What the issue is about. */
  readonly code: DeckIssueCode;
  /** A sentence describing the issue, for display. */
  readonly message: string;
  /** The card the issue concerns, when it concerns one. */
  readonly cardId?: string;
}

/** Everything the legality check found. */
export interface DeckReport {
  /** Cards in the deck, starting hand included. */
  readonly size: number;
  /** The side the starting character leads, when one is chosen and known. */
  readonly side?: DeckSide;
  /** Broken deck rules. The deck cannot be played while any remain. */
  readonly errors: readonly DeckIssue[];
  /** Legal cards this deck can never put into play. */
  readonly warnings: readonly DeckIssue[];
  /** Broken tournament rules. */
  readonly tournamentProblems: readonly DeckIssue[];
}

/**
 * Build an issue, leaving the card id off when there is none.
 *
 * @param code - What the issue is about.
 * @param message - The sentence to display.
 * @param cardId - The card concerned, if any.
 * @returns The issue.
 */
function issue(code: DeckIssueCode, message: string, cardId?: string): DeckIssue {
  return cardId === undefined ? { code, message } : { code, message, cardId };
}

/**
 * Phrase a count of copies.
 *
 * @param count - How many.
 * @returns For example "1 copy" or "3 copies".
 */
function copiesText(count: number): string {
  return count === 1 ? '1 copy' : `${count} copies`;
}

/**
 * Check a deck against the deck construction rules.
 *
 * @param deck - The deck.
 * @param cardsById - Every card by id.
 * @returns The report.
 */
export function checkDeck(deck: Deck, cardsById: ReadonlyMap<string, Card>): DeckReport {
  const errors: DeckIssue[] = [];
  const warnings: DeckIssue[] = [];
  const tournamentProblems: DeckIssue[] = [];
  const size = deckSize(deck);

  function nameOf(cardId: string): string {
    return cardsById.get(cardId)?.name ?? cardId;
  }

  const referenced = new Set([
    ...deck.entries.map((entry) => entry.cardId),
    ...[deck.startingCharacterId, ...deck.startingHandIds].filter((id) => id !== undefined),
    ...[deck.startingAdvantageId, deck.faceDownDragonRebornId].filter((id) => id !== undefined),
  ]);
  for (const cardId of referenced) {
    if (!cardsById.has(cardId)) {
      errors.push(
        issue('unknown-card', `The deck refers to a card that does not exist: ${cardId}.`, cardId),
      );
    }
  }

  if (size < MIN_DECK_SIZE) {
    errors.push(
      issue('too-few-cards', `The deck has ${size} cards and needs at least ${MIN_DECK_SIZE}.`),
    );
  }

  for (const entry of deck.entries) {
    if (entry.count > MAX_COPIES) {
      errors.push(
        issue(
          'too-many-copies',
          `${nameOf(entry.cardId)} has ${copiesText(entry.count)}; the most allowed is ${MAX_COPIES}.`,
          entry.cardId,
        ),
      );
    }
  }

  const startingCard =
    deck.startingCharacterId === undefined ? undefined : cardsById.get(deck.startingCharacterId);
  const side = startingCard === undefined ? undefined : startingSideOf(startingCard);
  if (deck.startingCharacterId === undefined) {
    errors.push(issue('no-starting-character', 'Choose a Starting Hero or Villain.'));
  } else if (startingCard !== undefined && side === undefined) {
    errors.push(
      issue(
        'not-a-starting-character',
        `${startingCard.name} is not a Starting Hero or Villain.`,
        startingCard.id,
      ),
    );
  }

  const handUses = new Map<string, number>();
  for (const cardId of [deck.startingCharacterId, ...deck.startingHandIds]) {
    if (cardId !== undefined) {
      handUses.set(cardId, (handUses.get(cardId) ?? 0) + 1);
    }
  }
  for (const [cardId, uses] of handUses) {
    const copies = copiesOf(deck, cardId);
    if (uses > copies) {
      errors.push(
        issue(
          'starting-hand-not-in-deck',
          `The starting hand uses ${copiesText(uses)} of ${nameOf(cardId)}, but the deck holds ${copies}.`,
          cardId,
        ),
      );
    }
  }

  if (deck.startingHandIds.length !== STARTING_HAND_OTHER_CARDS) {
    errors.push(
      issue(
        'starting-hand-size',
        `The starting hand needs ${STARTING_HAND_OTHER_CARDS} cards besides the Starting Hero or Villain, and has ${deck.startingHandIds.length}.`,
      ),
    );
  }
  const handTypes = deck.startingHandIds
    .map((cardId) => cardsById.get(cardId)?.type)
    .filter((type) => type !== undefined);
  if (new Set(handTypes).size < handTypes.length) {
    errors.push(
      issue(
        'starting-hand-types',
        'The starting hand cards besides the Starting Hero or Villain must each be a different type.',
      ),
    );
  }

  const faceDownId = deck.faceDownDragonRebornId;
  const needsFaceDown = startingCard !== undefined && needsFaceDownDragonReborn(startingCard);
  if (needsFaceDown && faceDownId === undefined) {
    errors.push(
      issue(
        'face-down-dragon-reborn-missing',
        `${startingCard.name} begins the game with a Dragon Reborn Starting Hero face down. Choose one.`,
      ),
    );
  } else if (faceDownId !== undefined) {
    const faceDown = cardsById.get(faceDownId);
    if (!needsFaceDown) {
      errors.push(
        issue(
          'face-down-dragon-reborn-unused',
          'Only a Mat Cauthon or Perrin Aybara Starting Hero begins with a face-down Dragon Reborn.',
          faceDownId,
        ),
      );
    } else if (faceDown !== undefined && !isDragonRebornStartingHero(faceDown)) {
      errors.push(
        issue(
          'face-down-dragon-reborn-invalid',
          `${faceDown.name} is not a Dragon Reborn Starting Hero, so it cannot be the face-down card.`,
          faceDownId,
        ),
      );
    }
  }

  const advantage =
    deck.startingAdvantageId === undefined ? undefined : cardsById.get(deck.startingAdvantageId);
  if (advantage !== undefined && !isStartingAdvantage(advantage)) {
    errors.push(
      issue(
        'not-a-starting-advantage',
        `${advantage.name} is not a Starting Advantage, so it cannot begin in play.`,
        advantage.id,
      ),
    );
  }

  for (const entry of deck.entries) {
    const card = cardsById.get(entry.cardId);
    if (card === undefined) {
      continue;
    }
    const unplayableCopies = entry.count - (card.id === deck.startingCharacterId ? 1 : 0);
    if (startingSideOf(card) !== undefined) {
      if (unplayableCopies > 0) {
        warnings.push(
          issue(
            'unrecruitable-starting-character',
            `${card.name} can never be recruited. Starting Heroes and Villains only enter play as the starting character.`,
            card.id,
          ),
        );
      }
    } else if (side !== undefined && forbiddenSideOf(card) === side) {
      const allegiance = side === 'hero' ? 'Dark One' : 'Dragon';
      const player = side === 'hero' ? 'Hero' : 'Villain';
      warnings.push(
        issue(
          'unrecruitable-allegiance',
          `${card.name} has the ${allegiance} allegiance, so a ${player} player can never recruit it.`,
          card.id,
        ),
      );
    }
  }

  if (size < TOURNAMENT_MIN_DECK_SIZE) {
    tournamentProblems.push(
      issue(
        'tournament-too-few-cards',
        `A tournament deck needs at least ${TOURNAMENT_MIN_DECK_SIZE} cards.`,
      ),
    );
  }
  const charactersAndTroops = deck.entries.reduce((total, entry) => {
    const card = cardsById.get(entry.cardId);
    return card !== undefined && isCharacterOrTroop(card) ? total + entry.count : total;
  }, 0);
  if (charactersAndTroops * 2 > size) {
    tournamentProblems.push(
      issue(
        'tournament-too-many-characters-and-troops',
        `${charactersAndTroops} of the ${size} cards are characters or troops, and a tournament deck allows at most half.`,
      ),
    );
  }

  return {
    size,
    ...(side === undefined ? {} : { side }),
    errors,
    warnings,
    tournamentProblems,
  };
}
