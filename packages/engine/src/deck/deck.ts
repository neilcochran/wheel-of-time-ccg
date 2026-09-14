/**
 * A deck as the builder holds it, and the pure edits the builder makes to it.
 *
 * A deck refers to cards by id only, so it serialises as plain JSON and knows
 * nothing of the card database. Whether a deck is legal is a separate
 * question, answered by `checkDeck`.
 */

/** One card in a deck and how many copies of it the deck holds. */
export interface DeckEntry {
  /** The card's id. */
  readonly cardId: string;
  /** Copies in the deck, at least one. */
  readonly count: number;
}

/** A saved deck. */
export interface Deck {
  /** Opaque identifier, unique among saved decks. */
  readonly id: string;
  /** Name the player gave the deck. */
  readonly name: string;
  /** When the deck was last saved, as an ISO 8601 timestamp. */
  readonly updatedAt: string;
  /** The cards in the deck, starting hand included, in the order they were first added. */
  readonly entries: readonly DeckEntry[];
  /** The Starting Hero or Villain, one of the deck's own cards. Absent until chosen. */
  readonly startingCharacterId?: string;
  /** The other starting hand cards, up to three, each one of the deck's own cards. */
  readonly startingHandIds: readonly string[];
  /** A Starting Advantage that begins in play. It sits outside the deck. */
  readonly startingAdvantageId?: string;
  /**
   * The Dragon Reborn Starting Hero a Mat Cauthon or Perrin Aybara deck begins
   * with face down. It sits outside both the deck and the starting hand.
   */
  readonly faceDownDragonRebornId?: string;
}

/**
 * Make a new, empty deck.
 *
 * @param id - Identifier for the deck, from {@link newDeckId}.
 * @param name - The deck's name.
 * @param updatedAt - Creation time as an ISO 8601 timestamp.
 * @returns The deck.
 */
export function createDeck(id: string, name: string, updatedAt: string): Deck {
  return { id, name, updatedAt, entries: [], startingHandIds: [] };
}

/**
 * Generate an opaque deck identifier.
 *
 * `crypto.randomUUID` only exists in secure contexts, and a second machine on
 * the LAN reaches the app over plain http, so this builds the id from
 * `getRandomValues`, which is available everywhere.
 *
 * @returns 32 lower-case hex digits.
 */
export function newDeckId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * How many copies of a card a deck holds.
 *
 * @param deck - The deck.
 * @param cardId - The card's id.
 * @returns The copy count, zero when the card is not in the deck.
 */
export function copiesOf(deck: Deck, cardId: string): number {
  return deck.entries.find((entry) => entry.cardId === cardId)?.count ?? 0;
}

/**
 * How many cards a deck holds, starting hand included.
 *
 * @param deck - The deck.
 * @returns The total copy count.
 */
export function deckSize(deck: Deck): number {
  return deck.entries.reduce((total, entry) => total + entry.count, 0);
}

/**
 * Add one copy of a card. The copy limit is not enforced here; the legality
 * check reports it.
 *
 * @param deck - The deck.
 * @param cardId - The card's id.
 * @returns The deck with one more copy.
 */
export function addCopy(deck: Deck, cardId: string): Deck {
  if (copiesOf(deck, cardId) === 0) {
    return { ...deck, entries: [...deck.entries, { cardId, count: 1 }] };
  }
  return {
    ...deck,
    entries: deck.entries.map((entry) =>
      entry.cardId === cardId ? { cardId, count: entry.count + 1 } : entry,
    ),
  };
}

/**
 * Remove one copy of a card, releasing any starting hand place the remaining
 * copies can no longer fill.
 *
 * @param deck - The deck.
 * @param cardId - The card's id.
 * @returns The deck with one fewer copy, or the same deck when it held none.
 */
export function removeCopy(deck: Deck, cardId: string): Deck {
  const remaining = copiesOf(deck, cardId) - 1;
  if (remaining < 0) {
    return deck;
  }
  const entries =
    remaining === 0
      ? deck.entries.filter((entry) => entry.cardId !== cardId)
      : deck.entries.map((entry) =>
          entry.cardId === cardId ? { cardId, count: remaining } : entry,
        );
  return fitStartingHand({ ...deck, entries }, cardId);
}

/**
 * Drop starting hand places for a card beyond the copies the deck holds.
 *
 * The other hand cards give way before the starting character does, since the
 * starting character is the harder choice to remake. A face-down Dragon Reborn
 * belongs to its starting character, so it goes when the character does.
 *
 * @param deck - The deck, possibly holding too few copies for its hand.
 * @param cardId - The card whose copies changed.
 * @returns The deck with a starting hand its copies can fill.
 */
function fitStartingHand(deck: Deck, cardId: string): Deck {
  const copies = copiesOf(deck, cardId);
  const isStartingCharacter = deck.startingCharacterId === cardId;
  let allowance = copies - (isStartingCharacter ? 1 : 0);
  const startingHandIds: string[] = [];
  for (const id of deck.startingHandIds) {
    if (id !== cardId) {
      startingHandIds.push(id);
    } else if (allowance > 0) {
      startingHandIds.push(id);
      allowance -= 1;
    }
  }
  const fitted = { ...deck, startingHandIds };
  if (isStartingCharacter && copies === 0) {
    return setFaceDownDragonReborn(setStartingCharacter(fitted, undefined), undefined);
  }
  return fitted;
}

/**
 * Rename a deck.
 *
 * @param deck - The deck.
 * @param name - The new name.
 * @returns The renamed deck.
 */
export function renameDeck(deck: Deck, name: string): Deck {
  return { ...deck, name };
}

/**
 * Choose or clear the Starting Hero or Villain.
 *
 * @param deck - The deck.
 * @param cardId - The card's id, or undefined to clear the choice.
 * @returns The updated deck.
 */
export function setStartingCharacter(deck: Deck, cardId: string | undefined): Deck {
  const { startingCharacterId: _, ...rest } = deck;
  return cardId === undefined ? rest : { ...rest, startingCharacterId: cardId };
}

/**
 * Replace the other starting hand cards.
 *
 * @param deck - The deck.
 * @param cardIds - The card ids, in slot order.
 * @returns The updated deck.
 */
export function setStartingHand(deck: Deck, cardIds: readonly string[]): Deck {
  return { ...deck, startingHandIds: [...cardIds] };
}

/**
 * Choose or clear the Starting Advantage that begins in play.
 *
 * @param deck - The deck.
 * @param cardId - The card's id, or undefined to clear the choice.
 * @returns The updated deck.
 */
export function setStartingAdvantage(deck: Deck, cardId: string | undefined): Deck {
  const { startingAdvantageId: _, ...rest } = deck;
  return cardId === undefined ? rest : { ...rest, startingAdvantageId: cardId };
}

/**
 * Choose or clear the face-down Dragon Reborn.
 *
 * @param deck - The deck.
 * @param cardId - The card's id, or undefined to clear the choice.
 * @returns The updated deck.
 */
export function setFaceDownDragonReborn(deck: Deck, cardId: string | undefined): Deck {
  const { faceDownDragonRebornId: _, ...rest } = deck;
  return cardId === undefined ? rest : { ...rest, faceDownDragonRebornId: cardId };
}
