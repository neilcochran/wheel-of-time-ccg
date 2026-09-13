import type { ReactElement } from 'react';
import { Link, useLocation } from 'react-router';

import type { Card } from '@wot/cards';

import { cardImageUrl, cardThumbnailUrl } from '../cards/images.ts';

/** Props for {@link CardGrid}. */
interface CardGridProps {
  /** The cards to show, already filtered and ordered. */
  readonly cards: readonly Card[];
}

/**
 * The browser's grid of card thumbnails, each linking to its detail page.
 *
 * The current query string travels in navigation state so the detail page can
 * link back to the same filtered view.
 *
 * @param props - The cards.
 * @returns The grid, or a message when nothing matches.
 */
export function CardGrid({ cards }: CardGridProps): ReactElement {
  const location = useLocation();
  if (cards.length === 0) {
    return <p className="empty-state">No cards match these filters.</p>;
  }
  return (
    <ul className="card-grid">
      {cards.map((card) => (
        <li key={card.id} className="card-tile">
          <Link to={`/cards/${card.id}`} state={{ browserSearch: location.search }}>
            <img
              src={cardThumbnailUrl(card)}
              srcSet={`${cardThumbnailUrl(card)} 1x, ${cardImageUrl(card)} 2x`}
              alt=""
              width={153}
              height={215}
              loading="lazy"
            />
            <span className="card-tile__name">{card.name}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
