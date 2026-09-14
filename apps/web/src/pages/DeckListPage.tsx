import type { ReactElement } from 'react';
import { Link, useNavigate } from 'react-router';

import { checkDeck, createDeck, newDeckId } from '@wot/engine';
import type { Deck } from '@wot/engine';

import { useCardDatabase } from '../cards/useCardDatabase.ts';
import { DECK_SIDE_LABELS, deckDisplayName, legalityLabel } from '../decks/labels.ts';
import { deckStore, useDecks } from '../decks/useDecks.ts';

/**
 * Every saved deck, with a way to start a new one.
 *
 * @returns The page element.
 */
export function DeckListPage(): ReactElement {
  const { decks, canSave, error } = useDecks();
  const { cardsById } = useCardDatabase();
  const navigate = useNavigate();

  function createAndOpen(): void {
    const deck = createDeck(newDeckId(), '', new Date().toISOString());
    if (deckStore.saveDeck(deck)) {
      void navigate(`/decks/${deck.id}`);
    }
  }

  function confirmDelete(deck: Deck): void {
    if (window.confirm(`Delete ${deckDisplayName(deck)}? This cannot be undone.`)) {
      deckStore.deleteDeck(deck.id);
    }
  }

  return (
    <section className="deck-list-page">
      <div className="page-heading">
        <h1>Decks</h1>
        <button type="button" className="button" onClick={createAndOpen} disabled={!canSave}>
          New deck
        </button>
      </div>

      {error === undefined ? null : (
        <p className="notice" role="alert">
          {error}
        </p>
      )}

      {decks.length === 0 ? (
        <p className="empty-state">No decks yet.</p>
      ) : (
        <ul className="deck-list">
          {decks.map((deck) => {
            const report = checkDeck(deck, cardsById);
            const side =
              report.side === undefined ? 'No starting character' : DECK_SIDE_LABELS[report.side];
            return (
              <li key={deck.id} className="deck-row">
                <Link to={`/decks/${deck.id}`} className="deck-row__name">
                  {deckDisplayName(deck)}
                </Link>
                <span className="deck-row__facts">
                  {side}, {report.size} cards, {legalityLabel(report).toLowerCase()}
                </span>
                <button
                  type="button"
                  className="button button--quiet"
                  onClick={() => confirmDelete(deck)}
                  disabled={!canSave}
                >
                  Delete
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
