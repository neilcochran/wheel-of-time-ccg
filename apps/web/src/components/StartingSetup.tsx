import type { ReactElement } from 'react';

import type { Card } from '@wot/cards';

import {
  setFaceDownDragonReborn,
  setStartingAdvantage,
  setStartingCharacter,
  setStartingHand,
} from '../decks/deck.ts';
import type { Deck } from '../decks/deck.ts';
import {
  STARTING_HAND_OTHER_CARDS,
  isDragonRebornStartingHero,
  isStartingAdvantage,
  needsFaceDownDragonReborn,
  startingSideOf,
} from '../decks/rules.ts';

/** Props for {@link StartingSetup}. */
interface StartingSetupProps {
  /** The deck being edited. */
  readonly deck: Deck;
  /** Every card, for the choices that sit outside the deck. */
  readonly cards: readonly Card[];
  /** Every card by id. */
  readonly cardsById: ReadonlyMap<string, Card>;
  /** Called with the whole updated deck on any change. */
  readonly onChange: (deck: Deck) => void;
}

/** Props for {@link CardSelect}. */
interface CardSelectProps {
  /** Label text. */
  readonly label: string;
  /** The chosen card id, or undefined for none. */
  readonly value: string | undefined;
  /** The cards to offer. */
  readonly options: readonly Card[];
  /** Option text for a card. Defaults to its name. */
  readonly describe?: (card: Card) => string;
  /** Called with the chosen card id, or undefined for none. */
  readonly onChange: (cardId: string | undefined) => void;
}

/**
 * A labelled select over cards, with a "None" choice. A chosen card missing
 * from the options is still shown, so the select never silently changes it.
 *
 * @param props - The label, value, options and change handler.
 * @returns The select element.
 */
function CardSelect({ label, value, options, describe, onChange }: CardSelectProps): ReactElement {
  const offered = value === undefined || options.some((card) => card.id === value);
  return (
    <label className="filter-select">
      {label}
      <select
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value === '' ? undefined : event.target.value)}
      >
        <option value="">None</option>
        {offered ? null : <option value={value}>{value}</option>}
        {options.map((card) => (
          <option key={card.id} value={card.id}>
            {describe === undefined ? card.name : describe(card)}
          </option>
        ))}
      </select>
    </label>
  );
}

/**
 * Order cards by name.
 *
 * @param a - First card.
 * @param b - Second card.
 * @returns Negative, zero or positive as a sorts before, with or after b.
 */
function byName(a: Card, b: Card): number {
  return a.name.localeCompare(b.name, 'en');
}

/**
 * The deck's starting choices: the Starting Hero or Villain, the other hand
 * cards, the Starting Advantage and, for Mat or Perrin, the face-down Dragon
 * Reborn.
 *
 * Hand cards come from the deck. The Starting Advantage and face-down card sit
 * outside it, so they are chosen from every card.
 *
 * @param props - The deck, the cards and the change handler.
 * @returns The setup section.
 */
export function StartingSetup({
  deck,
  cards,
  cardsById,
  onChange,
}: StartingSetupProps): ReactElement {
  const deckCards = deck.entries
    .map((entry) => cardsById.get(entry.cardId))
    .filter((card) => card !== undefined)
    .sort(byName);
  const startingOptions = deckCards.filter((card) => startingSideOf(card) !== undefined);
  const startingCard =
    deck.startingCharacterId === undefined ? undefined : cardsById.get(deck.startingCharacterId);
  const showFaceDown =
    (startingCard !== undefined && needsFaceDownDragonReborn(startingCard)) ||
    deck.faceDownDragonRebornId !== undefined;
  const handSlots = Math.min(deck.startingHandIds.length + 1, STARTING_HAND_OTHER_CARDS);

  function chooseStartingCharacter(cardId: string | undefined): void {
    const card = cardId === undefined ? undefined : cardsById.get(cardId);
    const next = setStartingCharacter(deck, cardId);
    onChange(
      card !== undefined && needsFaceDownDragonReborn(card)
        ? next
        : setFaceDownDragonReborn(next, undefined),
    );
  }

  function chooseHandCard(slot: number, cardId: string | undefined): void {
    const ids = [...deck.startingHandIds];
    if (cardId === undefined) {
      ids.splice(slot, 1);
    } else if (slot < ids.length) {
      ids[slot] = cardId;
    } else {
      ids.push(cardId);
    }
    onChange(setStartingHand(deck, ids));
  }

  return (
    <section className="starting-setup" aria-labelledby="starting-setup-heading">
      <h2 id="starting-setup-heading">Starting hand</h2>
      <CardSelect
        label="Starting Hero or Villain"
        value={deck.startingCharacterId}
        options={startingOptions}
        onChange={chooseStartingCharacter}
      />
      {startingOptions.length === 0 ? (
        <p className="hint">Add a Starting Hero or Villain to the deck to choose one.</p>
      ) : null}
      {Array.from({ length: handSlots }, (_, slot) => (
        <CardSelect
          key={slot}
          label={`Hand card ${slot + 1}`}
          value={deck.startingHandIds[slot]}
          options={deckCards}
          describe={(card) => `${card.name} (${card.type})`}
          onChange={(cardId) => chooseHandCard(slot, cardId)}
        />
      ))}
      <CardSelect
        label="Starting Advantage in play"
        value={deck.startingAdvantageId}
        options={cards.filter(isStartingAdvantage).sort(byName)}
        onChange={(cardId) => onChange(setStartingAdvantage(deck, cardId))}
      />
      {showFaceDown ? (
        <CardSelect
          label="Face-down Dragon Reborn"
          value={deck.faceDownDragonRebornId}
          options={cards.filter(isDragonRebornStartingHero)}
          onChange={(cardId) => onChange(setFaceDownDragonReborn(deck, cardId))}
        />
      ) : null}
    </section>
  );
}
