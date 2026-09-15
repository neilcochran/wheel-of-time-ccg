import type { ReactElement } from 'react';
import { Link } from 'react-router';

import type { Card } from '@wot/cards';
import { copiesOf } from '@wot/engine';
import type { Deck } from '@wot/engine';

import { cardImageUrl, cardThumbnailUrl } from '../cards/images.ts';

import { CopyCounter } from './CopyCounter.tsx';

/** Props for {@link DeckCardPicker}. */
interface DeckCardPickerProps {
  /** The cards to show, already filtered and ordered. */
  readonly cards: readonly Card[];
  /** The deck being edited. */
  readonly deck: Deck;
  /** Called with a card id to add a copy. */
  readonly onAdd: (cardId: string) => void;
  /** Called with a card id to remove a copy. */
  readonly onRemove: (cardId: string) => void;
}

/**
 * The deck editor's grid of cards, each with its copy count in the deck.
 *
 * @param props - The cards, the deck and the change handlers.
 * @returns The grid, or a message when nothing matches.
 */
export function DeckCardPicker({
  cards,
  deck,
  onAdd,
  onRemove,
}: DeckCardPickerProps): ReactElement {
  if (cards.length === 0) {
    return <p className="empty-state">No cards match these filters.</p>;
  }
  return (
    <ul className="card-grid">
      {cards.map((card) => (
        <li key={card.id} className="card-tile">
          <Link to={`/cards/${card.id}`}>
            <img
              src={cardThumbnailUrl(card)}
              srcSet={`${cardThumbnailUrl(card)} 1x, ${cardImageUrl(card)} 2x`}
              alt=""
              width={180}
              height={252}
              loading="lazy"
            />
            <span className="card-tile__name">{card.name}</span>
          </Link>
          <CopyCounter
            name={card.name}
            copies={copiesOf(deck, card.id)}
            onAdd={() => onAdd(card.id)}
            onRemove={() => onRemove(card.id)}
          />
        </li>
      ))}
    </ul>
  );
}
