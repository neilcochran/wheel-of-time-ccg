import { beforeEach, describe, expect, it } from 'vitest';

import { createDeck } from './deck.ts';
import { DECK_STORAGE_KEY } from './deckStorage.ts';
import { createDeckStore } from './deckStore.ts';

beforeEach(() => {
  window.localStorage.clear();
});

/**
 * A clock that advances one second on every reading.
 *
 * @returns The clock.
 */
function tickingClock(): () => Date {
  let seconds = 0;
  return () => {
    seconds += 1;
    return new Date(Date.UTC(2026, 8, 13, 0, 0, seconds));
  };
}

describe('createDeckStore', () => {
  it('saves decks through to storage, most recent first', () => {
    const store = createDeckStore(window.localStorage, tickingClock());
    expect(store.getSnapshot()).toEqual({ decks: [], canSave: true });

    expect(store.saveDeck(createDeck('a', 'First', ''))).toBe(true);
    expect(store.saveDeck(createDeck('b', 'Second', ''))).toBe(true);
    expect(store.getSnapshot().decks.map((deck) => deck.id)).toEqual(['b', 'a']);
    expect(store.getSnapshot().decks[1]?.updatedAt).toBe('2026-09-13T00:00:01.000Z');

    const reopened = createDeckStore(window.localStorage);
    expect(reopened.getSnapshot().decks.map((deck) => deck.name)).toEqual(['Second', 'First']);
  });

  it('replaces a deck saved again and deletes by id', () => {
    const store = createDeckStore(window.localStorage, tickingClock());
    store.saveDeck(createDeck('a', 'First', ''));
    store.saveDeck(createDeck('b', 'Second', ''));
    store.saveDeck(createDeck('a', 'Renamed', ''));
    expect(store.getSnapshot().decks.map((deck) => deck.name)).toEqual(['Renamed', 'Second']);

    expect(store.deleteDeck('a')).toBe(true);
    expect(
      createDeckStore(window.localStorage)
        .getSnapshot()
        .decks.map((deck) => deck.id),
    ).toEqual(['b']);
  });

  it('notifies subscribers until they unsubscribe', () => {
    const store = createDeckStore(window.localStorage);
    let calls = 0;
    const unsubscribe = store.subscribe(() => {
      calls += 1;
    });
    store.saveDeck(createDeck('a', 'First', ''));
    unsubscribe();
    store.saveDeck(createDeck('b', 'Second', ''));
    expect(calls).toBe(1);
  });

  it('refuses to save over decks it could not read', () => {
    window.localStorage.setItem(DECK_STORAGE_KEY, '{broken');
    const store = createDeckStore(window.localStorage);
    expect(store.getSnapshot().canSave).toBe(false);
    expect(store.getSnapshot().error).toContain('not valid JSON');
    expect(store.saveDeck(createDeck('a', 'First', ''))).toBe(false);
    expect(window.localStorage.getItem(DECK_STORAGE_KEY)).toBe('{broken');
  });

  it('picks up changes made elsewhere on reload', () => {
    const store = createDeckStore(window.localStorage);
    createDeckStore(window.localStorage).saveDeck(createDeck('a', 'Elsewhere', ''));
    expect(store.getSnapshot().decks).toEqual([]);
    store.reload();
    expect(store.getSnapshot().decks.map((deck) => deck.name)).toEqual(['Elsewhere']);
  });

  it('reports a failed write and keeps the decks it had', () => {
    const full: Storage = {
      length: 0,
      clear() {},
      getItem() {
        return null;
      },
      key() {
        return null;
      },
      removeItem() {},
      setItem() {
        throw new Error('quota exceeded');
      },
    };
    const store = createDeckStore(full);
    expect(store.saveDeck(createDeck('a', 'First', ''))).toBe(false);
    expect(store.getSnapshot().decks).toEqual([]);
    expect(store.getSnapshot().canSave).toBe(true);
    expect(store.getSnapshot().error).toContain('could not be saved');
  });

  it('cannot save without storage', () => {
    const store = createDeckStore(undefined);
    expect(store.getSnapshot().canSave).toBe(false);
    expect(store.saveDeck(createDeck('a', 'First', ''))).toBe(false);
  });
});
