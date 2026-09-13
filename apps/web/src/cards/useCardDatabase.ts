import { useContext } from 'react';

import { CardDatabaseContext } from './cardDatabaseContext.ts';
import type { CardDatabaseView } from './cardDatabaseContext.ts';

/**
 * Read the card database from context.
 *
 * @returns The database view.
 * @throws If called outside a `CardDatabaseProvider`, which is a wiring
 *         mistake rather than a runtime condition.
 */
export function useCardDatabase(): CardDatabaseView {
  const view = useContext(CardDatabaseContext);
  if (view === undefined) {
    throw new Error('useCardDatabase must be used inside a CardDatabaseProvider');
  }
  return view;
}
