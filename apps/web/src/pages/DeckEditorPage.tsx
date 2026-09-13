import { useMemo } from 'react';
import type { ReactElement } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';

import { filterCards, parseCardFilter, toSearchParams } from '../cards/filter.ts';
import type { CardFilter } from '../cards/filter.ts';
import { useCardDatabase } from '../cards/useCardDatabase.ts';
import { DeckCardPicker } from '../components/DeckCardPicker.tsx';
import { DeckContents } from '../components/DeckContents.tsx';
import { DeckReportPanel } from '../components/DeckReportPanel.tsx';
import { FilterPanel } from '../components/FilterPanel.tsx';
import { StartingSetup } from '../components/StartingSetup.tsx';
import { checkDeck } from '../decks/checkDeck.ts';
import { addCopy, removeCopy, renameDeck } from '../decks/deck.ts';
import type { Deck } from '../decks/deck.ts';
import { deckStore, useDecks } from '../decks/useDecks.ts';

import { NotFoundPage } from './NotFoundPage.tsx';

/**
 * One deck: the card pool to add from, and the deck with its starting hand
 * and legality beside it.
 *
 * Every change is saved as it is made. The card filter lives in the query
 * string, as it does in the card browser.
 *
 * @returns The page element, or the not-found page for an unknown deck id.
 */
export function DeckEditorPage(): ReactElement {
  const { deckId } = useParams();
  const { decks, error } = useDecks();
  const { database, cardsById } = useCardDatabase();
  const [searchParams, setSearchParams] = useSearchParams();

  const filter = useMemo(() => parseCardFilter(searchParams), [searchParams]);
  const matches = useMemo(() => filterCards(database.cards, filter), [database, filter]);
  const deck = decks.find((saved) => saved.id === deckId);
  const report = useMemo(
    () => (deck === undefined ? undefined : checkDeck(deck, cardsById)),
    [deck, cardsById],
  );

  if (deck === undefined || report === undefined) {
    if (error !== undefined) {
      return (
        <section className="message-page">
          <h1>Decks unavailable</h1>
          <p>{error}</p>
          <Link to="/decks">Back to decks</Link>
        </section>
      );
    }
    return <NotFoundPage />;
  }

  function save(next: Deck): void {
    deckStore.saveDeck(next);
  }

  function updateFilter(next: CardFilter): void {
    setSearchParams(toSearchParams(next), { replace: true });
  }

  return (
    <div className="deck-editor">
      <FilterPanel
        filter={filter}
        onChange={updateFilter}
        matchCount={matches.length}
        totalCount={database.cards.length}
      />

      <section className="deck-editor__cards" aria-label="Cards to add">
        <DeckCardPicker
          cards={matches}
          deck={deck}
          onAdd={(cardId) => save(addCopy(deck, cardId))}
          onRemove={(cardId) => save(removeCopy(deck, cardId))}
        />
      </section>

      <aside className="deck-panel" aria-label="Deck">
        <Link to="/decks">All decks</Link>
        <label className="deck-panel__name">
          <span className="visually-hidden">Deck name</span>
          <input
            type="text"
            placeholder="Untitled deck"
            value={deck.name}
            onChange={(event) => save(renameDeck(deck, event.target.value))}
          />
        </label>
        {error === undefined ? null : (
          <p className="notice" role="alert">
            {error}
          </p>
        )}
        <DeckReportPanel report={report} />
        <StartingSetup deck={deck} cards={database.cards} cardsById={cardsById} onChange={save} />
        <DeckContents
          deck={deck}
          cardsById={cardsById}
          onAdd={(cardId) => save(addCopy(deck, cardId))}
          onRemove={(cardId) => save(removeCopy(deck, cardId))}
        />
      </aside>
    </div>
  );
}
