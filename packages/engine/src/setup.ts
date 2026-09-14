/**
 * Starting a game from two decks.
 *
 * Each player's starting character begins at the home front and their three
 * other hand cards in hand. A Starting Advantage begins in play on its player,
 * and a Mat or Perrin deck's Dragon Reborn begins face down. Everything else
 * is shuffled into the deck, and each player places two tokens on their
 * section of the Pattern.
 */

import { NO_MODIFIERS, hasTrait } from './cardRules.ts';
import { checkDeck } from './deck/checkDeck.ts';
import type { Deck } from './deck/deck.ts';
import type { DeckSide } from './deck/rules.ts';
import { beginTurn } from './flow.ts';
import { seedRandom, shuffle } from './random.ts';
import { fail, ok } from './result.ts';
import type { Result } from './result.ts';
import { GAME_STATE_VERSION } from './state.ts';
import type { CardInstance, CardLookup, GameState, PlayerState } from './state.ts';
import { PLAYER_NAMES, SIDES, withLog } from './stateOps.ts';

/** Tokens each player begins with on their section of the Pattern. */
const STARTING_PATTERN_TOKENS = 2;

/** What a game is started from. */
export interface GameSetup {
  /** The Hero player's deck. */
  readonly hero: Deck;
  /** The Villain player's deck. */
  readonly villain: Deck;
  /** Seed for dice and shuffles: up to four integers. */
  readonly seed: readonly number[];
}

/**
 * Start a game.
 *
 * @param setup - The two decks and the seed.
 * @param cards - The card database.
 * @returns The game at its first decision, or why the decks cannot start one.
 */
export function createGame(setup: GameSetup, cards: CardLookup): Result<GameState> {
  const instances: Record<string, CardInstance> = {};
  let counter = 0;

  function createInstance(side: DeckSide, cardId: string): string {
    counter += 1;
    const id = `${side}-${counter}`;
    instances[id] = {
      id,
      cardId,
      owner: side,
      rotated: false,
      damage: 0,
      lastingModifiers: NO_MODIFIERS,
      turnModifiers: NO_MODIFIERS,
    };
    return id;
  }

  let random = seedRandom(setup.seed);
  const players: Partial<Record<DeckSide, PlayerState>> = {};
  const enteredUnique: string[] = [];
  const opening: string[] = [];

  for (const side of SIDES) {
    const deck = setup[side];
    const label = side === 'hero' ? 'Hero' : 'Villain';
    const report = checkDeck(deck, cards);
    const firstError = report.errors[0];
    if (firstError !== undefined) {
      return fail(`The ${label} deck is not legal: ${firstError.message}`);
    }
    const startingCardId = deck.startingCharacterId;
    if (report.side !== side || startingCardId === undefined) {
      return fail(`The ${label} deck must be led by a Starting ${label}.`);
    }

    const remaining = new Map(deck.entries.map((entry) => [entry.cardId, entry.count]));
    function takeFromDeck(cardId: string): string {
      remaining.set(cardId, (remaining.get(cardId) ?? 0) - 1);
      return createInstance(side, cardId);
    }

    const startingCharacter = takeFromDeck(startingCardId);
    const hand = deck.startingHandIds.map(takeFromDeck);
    const library: string[] = [];
    for (const entry of deck.entries) {
      for (let copy = 0; copy < (remaining.get(entry.cardId) ?? 0); copy += 1) {
        library.push(createInstance(side, entry.cardId));
      }
    }
    const shuffled = shuffle(random, library);
    random = shuffled.state;

    const advantages: string[] = [];
    if (deck.startingAdvantageId !== undefined) {
      const id = createInstance(side, deck.startingAdvantageId);
      const created = instances[id];
      const world = cards.get(deck.startingAdvantageId)?.subtype === 'World';
      if (created !== undefined) {
        instances[id] = {
          ...created,
          attachedTo: world ? { kind: 'world' } : { kind: 'player', side },
        };
      }
      advantages.push(id);
    }
    const faceDown =
      deck.faceDownDragonRebornId === undefined
        ? undefined
        : createInstance(side, deck.faceDownDragonRebornId);

    players[side] = {
      deck: shuffled.value,
      hand,
      discard: [],
      killed: [],
      removed: [],
      homeFront: [startingCharacter],
      battleground: [],
      advantages,
      startingCharacter,
      pool: [],
      handSizeModifier: 0,
      ...(faceDown === undefined ? {} : { faceDownDragonReborn: faceDown }),
    };

    const inPlay = [startingCardId, deck.startingAdvantageId]
      .filter((cardId) => cardId !== undefined)
      .map((cardId) => cards.get(cardId))
      .filter((card) => card !== undefined);
    for (const card of inPlay) {
      if (hasTrait(card, 'Unique')) {
        enteredUnique.push(card.id);
      }
    }
    opening.push(
      `${PLAYER_NAMES[side]} begins with ${inPlay.map((card) => card.name).join(' and ')} in play.`,
    );
  }

  const hero = players.hero;
  const villain = players.villain;
  if (hero === undefined || villain === undefined) {
    return fail('Both decks are needed to start a game.');
  }
  let state: GameState = {
    version: GAME_STATE_VERSION,
    random,
    nextId: 1,
    turn: 0,
    dominant: 'villain',
    pattern: {
      hero: STARTING_PATTERN_TOKENS,
      villain: STARTING_PATTERN_TOKENS,
      neutral: 0,
    },
    lastBattlePending: false,
    cards: instances,
    players: { hero, villain },
    challenges: [],
    enteredUnique,
    // beginTurn sets the first real step.
    step: { kind: 'declareChallenges', declarations: {} },
    log: [],
  };
  for (const text of opening) {
    state = withLog(state, text);
  }
  return ok(beginTurn(state, 1));
}
