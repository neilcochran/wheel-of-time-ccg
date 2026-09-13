import { useSyncExternalStore } from 'react';

import { DECK_STORAGE_KEY } from './deckStorage.ts';
import { createDeckStore } from './deckStore.ts';
import type { DeckStore, DeckStoreSnapshot } from './deckStore.ts';

/**
 * Local storage, if the browser allows it. Some privacy settings make merely
 * reading the property throw.
 *
 * @returns The storage, or undefined when it is unavailable.
 */
function openLocalStorage(): Storage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

/** The app's one deck store, over local storage. */
export const deckStore: DeckStore = createDeckStore(openLocalStorage());

/**
 * Subscribe to the store, and to writes other tabs make to the same storage.
 *
 * @param listener - Called after every change.
 * @returns The unsubscribe function.
 */
function subscribe(listener: () => void): () => void {
  function onStorage(event: StorageEvent): void {
    if (event.key === DECK_STORAGE_KEY || event.key === null) {
      deckStore.reload();
    }
  }
  window.addEventListener('storage', onStorage);
  const unsubscribe = deckStore.subscribe(listener);
  return () => {
    window.removeEventListener('storage', onStorage);
    unsubscribe();
  };
}

/**
 * Read the saved decks, re-rendering whenever they change.
 *
 * @returns The current snapshot.
 */
export function useDecks(): DeckStoreSnapshot {
  return useSyncExternalStore(subscribe, deckStore.getSnapshot);
}
