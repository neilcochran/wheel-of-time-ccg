import { createContext } from 'react';

import type { Card, CardDatabase } from '@wot/cards';

/** The decoded database plus the lookups pages need from it. */
export interface CardDatabaseView {
  /** The decoded database. */
  readonly database: CardDatabase;
  /** Every card by id, for the detail route. */
  readonly cardsById: ReadonlyMap<string, Card>;
}

/** Carries the card database to every page. Undefined outside the provider. */
export const CardDatabaseContext = createContext<CardDatabaseView | undefined>(undefined);
