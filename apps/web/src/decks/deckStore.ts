/**
 * The saved decks, held in memory and written through to storage on every
 * change.
 *
 * The store is shaped for `useSyncExternalStore`: a snapshot that is replaced,
 * never mutated, and a subscribe function. It takes its storage as a
 * parameter so tests can hand it a fake.
 */

import type { Deck } from './deck.ts';
import { DECK_STORAGE_KEY, decodeDecks, encodeDecks } from './deckStorage.ts';

/** What the store currently holds. */
export interface DeckStoreSnapshot {
  /** Every saved deck, most recently saved first. */
  readonly decks: readonly Deck[];
  /** False when saved decks could not be read, so saving would overwrite them. */
  readonly canSave: boolean;
  /** Why decks could not be read or the last save failed, when either happened. */
  readonly error?: string;
}

/** The saved decks store. */
export interface DeckStore {
  /** Register a listener called after every change. Returns the unsubscribe function. */
  readonly subscribe: (listener: () => void) => () => void;
  /** The current snapshot. The same object until something changes. */
  readonly getSnapshot: () => DeckStoreSnapshot;
  /** Re-read storage, for when another tab has written to it. */
  readonly reload: () => void;
  /** Save a deck, stamping its save time. Returns whether it was saved. */
  readonly saveDeck: (deck: Deck) => boolean;
  /** Delete a deck by id. Returns whether the deletion was saved. */
  readonly deleteDeck: (deckId: string) => boolean;
}

/** Shown when the browser refuses access to local storage altogether. */
const STORAGE_UNAVAILABLE =
  'This browser is not letting the app use local storage, so decks cannot be saved.';

/**
 * Order decks most recently saved first.
 *
 * @param decks - The decks.
 * @returns A new, sorted array.
 */
function newestFirst(decks: readonly Deck[]): Deck[] {
  return [...decks].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/**
 * Create a store over the given storage.
 *
 * @param storage - Where decks are kept, or undefined when storage is unavailable.
 * @param now - The clock used to stamp saves.
 * @returns The store, loaded with whatever storage already holds.
 */
export function createDeckStore(
  storage: Storage | undefined,
  now: () => Date = () => new Date(),
): DeckStore {
  const listeners = new Set<() => void>();

  function read(): DeckStoreSnapshot {
    if (storage === undefined) {
      return { decks: [], canSave: false, error: STORAGE_UNAVAILABLE };
    }
    let text: string | undefined;
    try {
      text = storage.getItem(DECK_STORAGE_KEY) ?? undefined;
    } catch {
      return { decks: [], canSave: false, error: STORAGE_UNAVAILABLE };
    }
    const result = decodeDecks(text);
    if (!result.ok) {
      return {
        decks: [],
        canSave: false,
        error: `Saved decks could not be read, so nothing will be saved over them. (${result.error})`,
      };
    }
    return { decks: newestFirst(result.decks), canSave: true };
  }

  let snapshot = read();

  function publish(next: DeckStoreSnapshot): void {
    snapshot = next;
    for (const listener of listeners) {
      listener();
    }
  }

  function write(decks: readonly Deck[]): boolean {
    if (storage === undefined || !snapshot.canSave) {
      return false;
    }
    try {
      storage.setItem(DECK_STORAGE_KEY, encodeDecks(decks));
    } catch {
      publish({
        ...snapshot,
        error: 'The last change could not be saved. The browser may be out of storage space.',
      });
      return false;
    }
    publish({ decks: newestFirst(decks), canSave: true });
    return true;
  }

  function subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }

  function getSnapshot(): DeckStoreSnapshot {
    return snapshot;
  }

  function reload(): void {
    publish(read());
  }

  function saveDeck(deck: Deck): boolean {
    const stamped = { ...deck, updatedAt: now().toISOString() };
    return write([stamped, ...snapshot.decks.filter((saved) => saved.id !== deck.id)]);
  }

  function deleteDeck(deckId: string): boolean {
    return write(snapshot.decks.filter((saved) => saved.id !== deckId));
  }

  return { subscribe, getSnapshot, reload, saveDeck, deleteDeck };
}
