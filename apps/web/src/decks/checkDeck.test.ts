import { describe, expect, it } from 'vitest';

import type { Card } from '@wot/cards';

import { checkDeck } from './checkDeck.ts';
import type { DeckIssue, DeckIssueCode } from './checkDeck.ts';
import {
  addCopy,
  removeCopy,
  setFaceDownDragonReborn,
  setStartingAdvantage,
  setStartingCharacter,
  setStartingHand,
} from './deck.ts';
import type { Deck, DeckEntry } from './deck.ts';

/**
 * Build a card with sensible defaults for whatever a test does not set.
 *
 * @param overrides - Fields that matter to the test.
 * @returns A complete card, an event named after its id unless told otherwise.
 */
function makeCard(overrides: Partial<Card> & Pick<Card, 'id'>): Card {
  return {
    name: overrides.id,
    setId: 'premiere',
    collectorNumber: 1,
    type: 'Event',
    rarity: { code: 'C', class: 'Common', sheetFrequency: 2 },
    allegiances: [],
    traits: [],
    abilities: { politics: {}, intrigue: {}, onePower: {}, combat: {} },
    image: 'card.jpg',
    thumbnail: 'card_SM.jpg',
    ...overrides,
  };
}

const FILLERS = Array.from({ length: 20 }, (_, index) => makeCard({ id: `filler-${index + 1}` }));
const SOLDIERS = Array.from({ length: 10 }, (_, index) =>
  makeCard({ id: `soldier-${index + 1}`, type: 'Character', allegiances: ['Andor'] }),
);

const CARDS: readonly Card[] = [
  makeCard({
    id: 'rand',
    type: 'Character',
    allegiances: ['Dragon'],
    traits: ['Starting Hero', 'Dragon Reborn'],
  }),
  makeCard({ id: 'mat', type: 'Character', allegiances: ['Dragon'], traits: ['Starting Hero'] }),
  makeCard({
    id: 'ishamael',
    type: 'Character',
    allegiances: ['Dark One'],
    traits: ['Starting Villain'],
  }),
  makeCard({ id: 'hand-advantage', type: 'Advantage' }),
  makeCard({ id: 'hand-challenge', type: 'Challenge' }),
  makeCard({ id: 'hand-event' }),
  makeCard({ id: 'sweat-tents', type: 'Advantage', traits: ['Starting Advantage'] }),
  makeCard({ id: 'trolloc', type: 'Troop', allegiances: ['Dark One'] }),
  makeCard({ id: 'dragonsworn', type: 'Troop', allegiances: ['Dragon'] }),
  ...FILLERS,
  ...SOLDIERS,
];

const CARDS_BY_ID: ReadonlyMap<string, Card> = new Map(CARDS.map((card) => [card.id, card]));

/**
 * A legal 50-card Hero deck led by Rand: three hand cards, a second copy of
 * the hand event, and 45 filler events.
 *
 * @param startingCharacterId - The starting character, added to the deck.
 * @returns The deck.
 */
function legalDeck(startingCharacterId = 'rand'): Deck {
  const entries: DeckEntry[] = [
    { cardId: startingCharacterId, count: 1 },
    { cardId: 'hand-advantage', count: 1 },
    { cardId: 'hand-challenge', count: 1 },
    { cardId: 'hand-event', count: 2 },
    ...FILLERS.slice(0, 15).map((card) => ({ cardId: card.id, count: 3 })),
  ];
  return {
    id: 'deck',
    name: 'Test',
    updatedAt: '2026-09-13T00:00:00.000Z',
    entries,
    startingCharacterId,
    startingHandIds: ['hand-advantage', 'hand-challenge', 'hand-event'],
  };
}

/**
 * The codes of a list of issues.
 *
 * @param issues - The issues.
 * @returns Their codes, in order.
 */
function codes(issues: readonly DeckIssue[]): DeckIssueCode[] {
  return issues.map((issue) => issue.code);
}

describe('checkDeck', () => {
  it('passes a legal 50-card deck, which is short of tournament size', () => {
    const report = checkDeck(legalDeck(), CARDS_BY_ID);
    expect(report.size).toBe(50);
    expect(report.side).toBe('hero');
    expect(report.errors).toEqual([]);
    expect(report.warnings).toEqual([]);
    expect(codes(report.tournamentProblems)).toEqual(['tournament-too-few-cards']);
  });

  it('needs at least 50 cards', () => {
    const report = checkDeck(removeCopy(legalDeck(), 'filler-1'), CARDS_BY_ID);
    expect(codes(report.errors)).toEqual(['too-few-cards']);
  });

  it('allows at most three copies of a card', () => {
    const report = checkDeck(addCopy(legalDeck(), 'filler-1'), CARDS_BY_ID);
    expect(report.errors).toEqual([
      expect.objectContaining({ code: 'too-many-copies', cardId: 'filler-1' }),
    ]);
  });

  it('reports cards the database does not have', () => {
    const report = checkDeck(addCopy(legalDeck(), 'gone'), CARDS_BY_ID);
    expect(report.errors).toEqual([
      expect.objectContaining({ code: 'unknown-card', cardId: 'gone' }),
    ]);
  });

  it('needs a Starting Hero or Villain', () => {
    const report = checkDeck(setStartingCharacter(legalDeck(), undefined), CARDS_BY_ID);
    expect(codes(report.errors)).toEqual(['no-starting-character']);
    expect(report.side).toBeUndefined();
  });

  it('rejects a starting character without the trait', () => {
    const report = checkDeck(legalDeck('soldier-1'), CARDS_BY_ID);
    expect(codes(report.errors)).toEqual(['not-a-starting-character']);
  });

  it('needs three other hand cards of different types', () => {
    const short = checkDeck(setStartingHand(legalDeck(), ['hand-event']), CARDS_BY_ID);
    expect(codes(short.errors)).toEqual(['starting-hand-size']);

    const sameType = setStartingHand(legalDeck(), ['hand-event', 'hand-event', 'hand-challenge']);
    expect(codes(checkDeck(sameType, CARDS_BY_ID).errors)).toEqual(['starting-hand-types']);
  });

  it('draws the starting hand from the deck', () => {
    const outside = setStartingHand(legalDeck(), ['soldier-1', 'hand-advantage', 'hand-event']);
    expect(checkDeck(outside, CARDS_BY_ID).errors).toEqual([
      expect.objectContaining({ code: 'starting-hand-not-in-deck', cardId: 'soldier-1' }),
    ]);

    const overused = setStartingHand(legalDeck(), [
      'hand-challenge',
      'hand-challenge',
      'hand-event',
    ]);
    expect(codes(checkDeck(overused, CARDS_BY_ID).errors)).toEqual([
      'starting-hand-not-in-deck',
      'starting-hand-types',
    ]);
  });

  it('gives Mat or Perrin a face-down Dragon Reborn and nobody else', () => {
    const mat = legalDeck('mat');
    expect(codes(checkDeck(mat, CARDS_BY_ID).errors)).toEqual(['face-down-dragon-reborn-missing']);
    expect(checkDeck(setFaceDownDragonReborn(mat, 'rand'), CARDS_BY_ID).errors).toEqual([]);
    expect(codes(checkDeck(setFaceDownDragonReborn(mat, 'soldier-1'), CARDS_BY_ID).errors)).toEqual(
      ['face-down-dragon-reborn-invalid'],
    );
    expect(
      codes(checkDeck(setFaceDownDragonReborn(legalDeck(), 'rand'), CARDS_BY_ID).errors),
    ).toEqual(['face-down-dragon-reborn-unused']);
  });

  it('keeps the Starting Advantage and face-down card outside deck size and copy limits', () => {
    let deck = setFaceDownDragonReborn(
      setStartingAdvantage(legalDeck('mat'), 'sweat-tents'),
      'rand',
    );
    deck = addCopy(addCopy(addCopy(deck, 'sweat-tents'), 'sweat-tents'), 'sweat-tents');
    deck = addCopy(addCopy(deck, 'rand'), 'rand');
    const report = checkDeck(deck, CARDS_BY_ID);
    expect(report.size).toBe(55);
    expect(report.errors).toEqual([]);
  });

  it('only lets a Starting Advantage begin in play', () => {
    const report = checkDeck(setStartingAdvantage(legalDeck(), 'hand-advantage'), CARDS_BY_ID);
    expect(codes(report.errors)).toEqual(['not-a-starting-advantage']);
  });

  it('warns about cards the deck can never recruit', () => {
    const hero = addCopy(addCopy(addCopy(legalDeck(), 'trolloc'), 'rand'), 'dragonsworn');
    expect(checkDeck(hero, CARDS_BY_ID).warnings).toEqual([
      expect.objectContaining({ code: 'unrecruitable-starting-character', cardId: 'rand' }),
      expect.objectContaining({ code: 'unrecruitable-allegiance', cardId: 'trolloc' }),
    ]);

    const villain = addCopy(addCopy(legalDeck('ishamael'), 'dragonsworn'), 'trolloc');
    expect(checkDeck(villain, CARDS_BY_ID).warnings).toEqual([
      expect.objectContaining({ code: 'unrecruitable-allegiance', cardId: 'dragonsworn' }),
    ]);
  });

  it('checks tournament size and the character and troop share', () => {
    let deck = legalDeck();
    for (const card of FILLERS.slice(15, 18)) {
      deck = addCopy(addCopy(addCopy(deck, card.id), card.id), card.id);
    }
    deck = addCopy(deck, 'filler-19');
    const tournament = checkDeck(deck, CARDS_BY_ID);
    expect(tournament.size).toBe(60);
    expect(tournament.tournamentProblems).toEqual([]);

    // Rand plus 30 soldiers is 31 characters. At 62 cards that is exactly half.
    let half = legalDeck();
    for (const soldier of SOLDIERS) {
      half = addCopy(addCopy(addCopy(half, soldier.id), soldier.id), soldier.id);
    }
    for (const card of FILLERS.slice(0, 6)) {
      half = removeCopy(removeCopy(removeCopy(half, card.id), card.id), card.id);
    }
    const exactlyHalf = checkDeck(half, CARDS_BY_ID);
    expect(exactlyHalf.size).toBe(62);
    expect(exactlyHalf.tournamentProblems).toEqual([]);

    const overHalf = checkDeck(removeCopy(half, 'filler-7'), CARDS_BY_ID);
    expect(overHalf.size).toBe(61);
    expect(codes(overHalf.tournamentProblems)).toEqual([
      'tournament-too-many-characters-and-troops',
    ]);
  });
});
