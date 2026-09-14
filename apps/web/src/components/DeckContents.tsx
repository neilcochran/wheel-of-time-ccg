import type { ReactElement } from 'react';
import { Link } from 'react-router';

import { CARD_TYPES } from '@wot/cards';
import type { Card } from '@wot/cards';
import type { Deck } from '@wot/engine';

import { CopyCounter } from './CopyCounter.tsx';

/** Props for {@link DeckContents}. */
interface DeckContentsProps {
  /** The deck being edited. */
  readonly deck: Deck;
  /** Every card by id. */
  readonly cardsById: ReadonlyMap<string, Card>;
  /** Called with a card id to add a copy. */
  readonly onAdd: (cardId: string) => void;
  /** Called with a card id to remove a copy. */
  readonly onRemove: (cardId: string) => void;
}

/**
 * The note beside a card that is part of the starting hand.
 *
 * @param deck - The deck.
 * @param cardId - The card's id.
 * @returns The note, or undefined when the card is not in the hand.
 */
function handNote(deck: Deck, cardId: string): string | undefined {
  if (deck.startingCharacterId === cardId) {
    return 'Starting';
  }
  return deck.startingHandIds.includes(cardId) ? 'In hand' : undefined;
}

/**
 * The cards in a deck, grouped by type, each with its copy count.
 *
 * @param props - The deck, the card index and the change handlers.
 * @returns The list, or a prompt when the deck is empty.
 */
export function DeckContents({
  deck,
  cardsById,
  onAdd,
  onRemove,
}: DeckContentsProps): ReactElement {
  if (deck.entries.length === 0) {
    return <p className="empty-state">The deck is empty. Add cards from the grid.</p>;
  }

  const rows = deck.entries.map((entry) => ({ ...entry, card: cardsById.get(entry.cardId) }));
  const groups = [
    ...CARD_TYPES.map((type) => ({
      title: type,
      rows: rows.filter((row) => row.card?.type === type),
    })),
    { title: 'Unknown', rows: rows.filter((row) => row.card === undefined) },
  ];

  return (
    <section className="deck-contents" aria-label="Cards in the deck">
      {groups.map((group) => {
        if (group.rows.length === 0) {
          return null;
        }
        const sorted = [...group.rows].sort((a, b) =>
          (a.card?.name ?? a.cardId).localeCompare(b.card?.name ?? b.cardId, 'en'),
        );
        const total = sorted.reduce((sum, row) => sum + row.count, 0);
        return (
          <div key={group.title} className="deck-contents__group">
            <h2>
              {group.title} ({total})
            </h2>
            <ul className="deck-contents__list">
              {sorted.map((row) => {
                const name = row.card?.name ?? row.cardId;
                const note = handNote(deck, row.cardId);
                return (
                  <li key={row.cardId} className="deck-line">
                    {row.card === undefined ? (
                      <span className="deck-line__name">{name}</span>
                    ) : (
                      <Link to={`/cards/${row.cardId}`} className="deck-line__name">
                        {name}
                      </Link>
                    )}
                    {note === undefined ? null : <span className="deck-line__note">{note}</span>}
                    <CopyCounter
                      name={name}
                      copies={row.count}
                      onAdd={() => onAdd(row.cardId)}
                      onRemove={() => onRemove(row.cardId)}
                    />
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </section>
  );
}
