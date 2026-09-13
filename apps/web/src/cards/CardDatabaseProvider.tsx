import { useMemo } from 'react';
import type { ReactElement, ReactNode } from 'react';

import type { CardDatabase } from '@wot/cards';

import { CardDatabaseContext } from './cardDatabaseContext.ts';
import type { CardDatabaseView } from './cardDatabaseContext.ts';

/** Props for {@link CardDatabaseProvider}. */
interface CardDatabaseProviderProps {
  /** The decoded database to provide. */
  readonly database: CardDatabase;
  /** The tree that reads it. */
  readonly children: ReactNode;
}

/**
 * Provide the card database, and an id index over it, to the tree below.
 *
 * @param props - The database and children.
 * @returns The provider element.
 */
export function CardDatabaseProvider({
  database,
  children,
}: CardDatabaseProviderProps): ReactElement {
  const view = useMemo<CardDatabaseView>(
    () => ({
      database,
      cardsById: new Map(database.cards.map((card) => [card.id, card])),
    }),
    [database],
  );
  return <CardDatabaseContext value={view}>{children}</CardDatabaseContext>;
}
