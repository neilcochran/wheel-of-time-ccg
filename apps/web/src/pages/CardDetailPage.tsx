import type { ReactElement } from 'react';
import { Link, useLocation, useParams } from 'react-router';

import { ABILITY_TRACKS, formatRarity, getCardSet } from '@wot/cards';
import type { Card } from '@wot/cards';

import { cardImageUrl, printingImageUrl } from '../cards/images.ts';
import { useCardDatabase } from '../cards/useCardDatabase.ts';
import { AbilityTable } from '../components/AbilityTable.tsx';
import { CardText } from '../components/CardText.tsx';

import { NotFoundPage } from './NotFoundPage.tsx';

/**
 * Recover the browser's query string from navigation state, if the grid
 * link supplied one.
 *
 * @param state - The location state, which is untyped.
 * @returns The query string, or empty when none was passed.
 */
function browserSearchFrom(state: unknown): string {
  if (typeof state === 'object' && state !== null && 'browserSearch' in state) {
    const value = state.browserSearch;
    if (typeof value === 'string') {
      return value;
    }
  }
  return '';
}

/**
 * Whether a card has a rating or cost in any track.
 *
 * @param card - The card.
 * @returns True when the ability table would show something.
 */
function hasAbilities(card: Card): boolean {
  return ABILITY_TRACKS.some(
    (track) =>
      card.abilities[track].ability !== undefined || card.abilities[track].cost !== undefined,
  );
}

/**
 * One card: its scan beside everything the data records about it.
 *
 * @returns The page element, or the not-found page for an unknown id.
 */
export function CardDetailPage(): ReactElement {
  const { cardId } = useParams();
  const { database, cardsById } = useCardDatabase();
  const location = useLocation();

  const card = cardId === undefined ? undefined : cardsById.get(cardId);
  if (card === undefined) {
    return <NotFoundPage />;
  }

  const index = database.cards.indexOf(card);
  const previous = database.cards[index - 1];
  const next = database.cards[index + 1];
  const set = getCardSet(card.setId);
  const typeLine = card.subtype === undefined ? card.type : `${card.type} - ${card.subtype}`;

  return (
    <article className="card-detail">
      <nav className="card-detail__nav" aria-label="Card navigation">
        <Link to={{ pathname: '/cards', search: browserSearchFrom(location.state) }}>
          Back to cards
        </Link>
        <span className="card-detail__siblings">
          {previous === undefined ? null : (
            <Link to={`/cards/${previous.id}`} state={location.state}>
              Previous
            </Link>
          )}
          {next === undefined ? null : (
            <Link to={`/cards/${next.id}`} state={location.state}>
              Next
            </Link>
          )}
        </span>
      </nav>

      <div className="card-detail__body">
        <img
          className="card-detail__image"
          src={cardImageUrl(card)}
          alt={`Scan of ${card.name}`}
          width={305}
          height={430}
        />

        <div className="card-detail__facts">
          <h1>{card.name}</h1>
          <p className="card-detail__type">{typeLine}</p>

          <dl className="fact-list">
            <dt>Set</dt>
            <dd>
              {set?.name ?? card.setId} #{card.collectorNumber}
            </dd>
            <dt>Rarity</dt>
            <dd>{formatRarity(card.rarity)}</dd>
            {card.allegiances.length === 0 ? null : (
              <>
                <dt>Allegiances</dt>
                <dd>{card.allegiances.join(', ')}</dd>
              </>
            )}
            {card.traits.length === 0 ? null : (
              <>
                <dt>Traits</dt>
                <dd>{card.traits.join(', ')}</dd>
              </>
            )}
            {card.artist === undefined ? null : (
              <>
                <dt>Artist</dt>
                <dd>{card.artist}</dd>
              </>
            )}
          </dl>

          {hasAbilities(card) ? <AbilityTable abilities={card.abilities} /> : null}

          {card.effect === undefined ? null : (
            <section>
              <h2>Rules</h2>
              <p className="card-detail__effect">
                <CardText text={card.effect} />
              </p>
            </section>
          )}

          {card.lore === undefined ? null : (
            <section>
              <h2>Lore</h2>
              <p className="card-detail__lore">
                <CardText text={card.lore} />
              </p>
            </section>
          )}

          {card.otherPrintings === undefined ? null : (
            <section>
              <h2>Other printings</h2>
              <ul className="printing-list">
                {card.otherPrintings.map((printing) => (
                  <li key={printing.image} className="printing">
                    <img
                      src={printingImageUrl(card, printing)}
                      alt={`Scan of ${printing.name}`}
                      width={153}
                      height={215}
                      loading="lazy"
                    />
                    <div>
                      <p className="printing__name">{printing.name}</p>
                      <p>{printing.note}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </article>
  );
}
