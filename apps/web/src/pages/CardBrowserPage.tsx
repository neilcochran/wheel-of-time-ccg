import { useMemo } from 'react';
import type { ReactElement } from 'react';
import { useSearchParams } from 'react-router';

import { filterCards, parseCardFilter, toSearchParams } from '../cards/filter.ts';
import type { CardFilter } from '../cards/filter.ts';
import { useCardDatabase } from '../cards/useCardDatabase.ts';
import { CardGrid } from '../components/CardGrid.tsx';
import { FilterPanel } from '../components/FilterPanel.tsx';

/**
 * The card browser: filters on one side, the matching cards on the other.
 *
 * The filter lives in the query string. Changes replace the current history
 * entry, so the back button leaves the browser rather than stepping through
 * every keystroke.
 *
 * @returns The page element.
 */
export function CardBrowserPage(): ReactElement {
  const { database } = useCardDatabase();
  const [searchParams, setSearchParams] = useSearchParams();

  const filter = useMemo(() => parseCardFilter(searchParams), [searchParams]);
  const cards = useMemo(() => filterCards(database.cards, filter), [database, filter]);

  function updateFilter(next: CardFilter): void {
    setSearchParams(toSearchParams(next), { replace: true });
  }

  return (
    <div className="browser">
      <FilterPanel
        filter={filter}
        onChange={updateFilter}
        matchCount={cards.length}
        totalCount={database.cards.length}
      />
      <section className="browser__results" aria-label="Matching cards">
        <CardGrid cards={cards} />
      </section>
    </div>
  );
}
