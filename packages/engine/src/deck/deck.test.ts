import { describe, expect, it } from 'vitest';

import {
  addCopy,
  copiesOf,
  createDeck,
  deckSize,
  newDeckId,
  removeCopy,
  setFaceDownDragonReborn,
  setStartingAdvantage,
  setStartingCharacter,
  setStartingHand,
} from './deck.ts';

const EMPTY = createDeck('deck', 'Test', '2026-09-13T00:00:00.000Z');

describe('addCopy and removeCopy', () => {
  it('counts copies and drops an entry at zero', () => {
    const deck = addCopy(addCopy(addCopy(EMPTY, 'a'), 'b'), 'a');
    expect(copiesOf(deck, 'a')).toBe(2);
    expect(deckSize(deck)).toBe(3);
    expect(deck.entries.map((entry) => entry.cardId)).toEqual(['a', 'b']);

    const fewer = removeCopy(removeCopy(deck, 'a'), 'a');
    expect(copiesOf(fewer, 'a')).toBe(0);
    expect(fewer.entries).toEqual([{ cardId: 'b', count: 1 }]);
  });

  it('leaves the deck alone when removing a card it does not hold', () => {
    expect(removeCopy(EMPTY, 'missing')).toBe(EMPTY);
  });

  it('releases hand places before the starting character', () => {
    const deck = setStartingHand(setStartingCharacter(addCopy(addCopy(EMPTY, 'a'), 'a'), 'a'), [
      'a',
      'b',
    ]);

    const one = removeCopy(deck, 'a');
    expect(one.startingCharacterId).toBe('a');
    expect(one.startingHandIds).toEqual(['b']);

    const none = removeCopy(one, 'a');
    expect('startingCharacterId' in none).toBe(false);
    expect(none.startingHandIds).toEqual(['b']);
  });

  it('clears the face-down Dragon Reborn along with the starting character', () => {
    const deck = setFaceDownDragonReborn(
      setStartingCharacter(addCopy(EMPTY, 'mat'), 'mat'),
      'rand',
    );
    expect(removeCopy(deck, 'mat')).toEqual(EMPTY);
  });

  it('keeps as many hand places as there are copies', () => {
    const deck = setStartingHand(addCopy(addCopy(addCopy(EMPTY, 'a'), 'a'), 'a'), ['a', 'a', 'a']);
    expect(removeCopy(deck, 'a').startingHandIds).toEqual(['a', 'a']);
  });
});

describe('optional choices', () => {
  it('set a value and remove the key when cleared', () => {
    const chosen = setFaceDownDragonReborn(
      setStartingAdvantage(setStartingCharacter(EMPTY, 'hero'), 'advantage'),
      'rand',
    );
    expect(chosen).toMatchObject({
      startingCharacterId: 'hero',
      startingAdvantageId: 'advantage',
      faceDownDragonRebornId: 'rand',
    });

    const cleared = setFaceDownDragonReborn(
      setStartingAdvantage(setStartingCharacter(chosen, undefined), undefined),
      undefined,
    );
    expect(cleared).toEqual(EMPTY);
  });
});

describe('newDeckId', () => {
  it('gives distinct 32-digit hex ids', () => {
    const first = newDeckId();
    expect(first).toMatch(/^[0-9a-f]{32}$/);
    expect(newDeckId()).not.toBe(first);
  });
});
