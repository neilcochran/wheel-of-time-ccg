import { describe, expect, it } from 'vitest';

import type { Card } from '@wot/cards';

import type { DamageAssignment, GameAction } from './actions.ts';
import { applyAction } from './apply.ts';
import { damageUntilMortallyWounded } from './cardRules.ts';
import type { Deck, DeckEntry } from './deck/deck.ts';
import type { DeckSide } from './deck/rules.ts';
import { rollerEligible } from './flow.ts';
import { createGame } from './setup.ts';
import type { CardLookup, GameState } from './state.ts';
import { makeCard } from './testCards.ts';
import { viewFor, waitingOn } from './view.ts';

const FILLERS = Array.from({ length: 14 }, (_, index) => makeCard({ id: `filler-${index + 1}` }));

const CARDS: readonly Card[] = [
  makeCard({
    id: 'rand',
    name: "Rand al'Thor",
    type: 'Character',
    allegiances: ['Dragon'],
    traits: ['Starting Hero', 'Dragon Reborn', "Ta'veren"],
    abilities: {
      politics: { ability: 2 },
      intrigue: {},
      onePower: { ability: 3 },
      combat: { ability: 2 },
    },
  }),
  makeCard({
    id: 'ishamael',
    name: 'Ishamael',
    type: 'Character',
    allegiances: ['Dark One'],
    traits: ['Starting Villain', 'Forsaken'],
    abilities: {
      politics: {},
      intrigue: { ability: 3 },
      onePower: { ability: 4 },
      combat: { ability: 1 },
    },
  }),
  makeCard({
    id: 'pelivar',
    name: 'Lord Pelivar',
    type: 'Character',
    allegiances: ['Andor'],
    abilities: {
      politics: { ability: 2, cost: 2 },
      intrigue: {},
      onePower: {},
      combat: { ability: 1, cost: 1 },
    },
  }),
  makeCard({
    id: 'trollocs',
    name: 'Trolloc Footmen',
    type: 'Troop',
    allegiances: ['Dark One'],
    traits: ['Monster', 'Multiple'],
    abilities: { politics: {}, intrigue: {}, onePower: {}, combat: { ability: 5, cost: 2 } },
  }),
  makeCard({ id: 'hero-advantage', type: 'Advantage', subtype: 'Player' }),
  makeCard({ id: 'hero-challenge', type: 'Challenge' }),
  makeCard({ id: 'hero-event', name: 'Sudden Twist' }),
  ...FILLERS,
];

const CARDS_BY_ID: CardLookup = new Map(CARDS.map((card) => [card.id, card]));

/**
 * A legal 50-card deck.
 *
 * @param startingCharacterId - The Starting Hero or Villain.
 * @param extra - One more card, three copies.
 * @returns The deck.
 */
function makeDeck(startingCharacterId: string, extra: string): Deck {
  const entries: DeckEntry[] = [
    { cardId: startingCharacterId, count: 1 },
    { cardId: 'hero-advantage', count: 1 },
    { cardId: 'hero-challenge', count: 1 },
    { cardId: 'hero-event', count: 2 },
    { cardId: extra, count: 3 },
    ...FILLERS.map((card) => ({ cardId: card.id, count: 3 })),
  ];
  return {
    id: startingCharacterId,
    name: startingCharacterId,
    updatedAt: '2026-09-13T00:00:00.000Z',
    entries,
    startingCharacterId,
    startingHandIds: ['hero-advantage', 'hero-challenge', 'hero-event'],
  };
}

/**
 * Start a game between Rand and Ishamael.
 *
 * @param seed - The seed.
 * @returns The game at its first decision.
 */
function start(seed: readonly number[] = [7]): GameState {
  const result = createGame(
    { hero: makeDeck('rand', 'pelivar'), villain: makeDeck('ishamael', 'trollocs'), seed },
    CARDS_BY_ID,
  );
  if (!result.ok) {
    throw new Error(result.error);
  }
  return result.value;
}

/**
 * Apply an action that must succeed.
 *
 * @param state - The game.
 * @param action - The action.
 * @returns The game after it.
 */
function act(state: GameState, action: GameAction): GameState {
  const result = applyAction(state, action, CARDS_BY_ID);
  if (!result.ok) {
    throw new Error(`${action.type}: ${result.error}`);
  }
  return result.value;
}

/** A scripted player: given the game and their side, what they do. */
type Policy = (state: GameState, side: DeckSide) => GameAction;

/**
 * Place owed damage one card at a time, mortally wounding each before moving on.
 *
 * @param state - The game, at a damage assignment.
 * @param side - The player assigning.
 * @returns The assignments.
 */
function assignGreedily(state: GameState, side: DeckSide): DamageAssignment[] {
  const step = state.step;
  if (step.kind !== 'assignDamage') {
    return [];
  }
  const wanted = step.stage === 'openingMoves' ? 'Character' : 'Troop';
  const placed = new Map<string, number>();
  let remaining = step.owed[side];
  const targets = state.players[side].battleground.filter((id) => {
    const instance = state.cards[id];
    return (
      instance?.challengeId === step.challengeId &&
      CARDS_BY_ID.get(instance.cardId)?.type === wanted
    );
  });
  for (const id of targets) {
    const instance = state.cards[id];
    const card = CARDS_BY_ID.get(instance?.cardId ?? '');
    if (instance !== undefined && card !== undefined) {
      const damage = Math.min(remaining, damageUntilMortallyWounded(instance, card));
      if (damage > 0) {
        placed.set(id, damage);
        remaining -= damage;
      }
    }
  }
  const first = targets[0];
  if (remaining > 0 && first !== undefined) {
    placed.set(first, (placed.get(first) ?? 0) + remaining);
  }
  return [...placed].map(([instanceId, damage]) => ({ instanceId, damage }));
}

/**
 * The player who does as little as the rules allow.
 *
 * @param state - The game.
 * @param side - The player.
 * @returns The action.
 */
function passive(state: GameState, side: DeckSide): GameAction {
  const step = state.step;
  switch (step.kind) {
    case 'revealDragonReborn':
      return { type: 'revealDragonReborn', side, reveal: false };
    case 'declareChallenges':
      return { type: 'declareChallenge', side, declaration: { kind: 'none' } };
    case 'placeForces':
      return { type: 'placeForces', side, instanceIds: [] };
    case 'determineParticipation':
      return { type: 'commitParticipation', side, commitments: [] };
    case 'generateResources':
      return { type: 'endGenerateResources', side };
    case 'takeActions':
      return { type: 'endActions', side };
    case 'declareRollers':
      return { type: 'declareRollers', side, instanceIds: [] };
    case 'assignDamage':
      return { type: 'assignDamage', side, assignments: assignGreedily(state, side) };
    case 'eventWindow':
      return { type: 'pass', side };
    case 'discardDown': {
      const player = state.players[side];
      const excess = Math.max(0, player.hand.length - 8 - player.handSizeModifier);
      return { type: 'discardDown', side, instanceIds: player.hand.slice(0, excess) };
    }
    case 'gameOver':
      throw new Error('The game is over.');
  }
}

/**
 * The player who sends everything to the first challenge and rolls everything.
 *
 * @param state - The game.
 * @param side - The player.
 * @returns The action.
 */
function aggressive(state: GameState, side: DeckSide): GameAction {
  const step = state.step;
  switch (step.kind) {
    case 'placeForces':
      return { type: 'placeForces', side, instanceIds: state.players[side].homeFront };
    case 'determineParticipation': {
      const challengeId = state.challenges[0]?.id ?? '';
      return {
        type: 'commitParticipation',
        side,
        commitments: state.players[side].battleground.map((instanceId) => ({
          instanceId,
          challengeId,
        })),
      };
    }
    case 'declareRollers':
      return {
        type: 'declareRollers',
        side,
        instanceIds: rollerEligible(state, CARDS_BY_ID, step.challengeId, step.stage, side),
      };
    default:
      return passive(state, side);
  }
}

/**
 * Play on with scripted players until a condition holds.
 *
 * @param state - The game.
 * @param policies - Each player's script.
 * @param until - The condition to stop at.
 * @returns The game once the condition holds.
 */
function playUntil(
  state: GameState,
  policies: Readonly<Record<DeckSide, Policy>>,
  until: (state: GameState) => boolean,
): GameState {
  let current = state;
  for (let move = 0; move < 5000; move += 1) {
    if (until(current)) {
      return current;
    }
    const side = waitingOn(current)[0];
    if (side === undefined) {
      throw new Error('Nobody can act and the condition never held.');
    }
    current = act(current, policies[side](current, side));
  }
  throw new Error('The condition did not hold within 5000 moves.');
}

const PASSIVE = { hero: passive, villain: passive };
const AGGRESSIVE = { hero: aggressive, villain: aggressive };

/**
 * The instance of a card in a player's hand.
 *
 * @param state - The game.
 * @param side - The player.
 * @param cardId - The card.
 * @returns The instance id.
 */
function inHand(state: GameState, side: DeckSide, cardId: string): string {
  const id = state.players[side].hand.find(
    (candidate) => state.cards[candidate]?.cardId === cardId,
  );
  if (id === undefined) {
    throw new Error(`${cardId} is not in hand`);
  }
  return id;
}

describe('starting a game', () => {
  it('sets out both decks and opens the first event window', () => {
    const state = start();
    expect(state.pattern).toEqual({ hero: 2, villain: 2, neutral: 0 });
    for (const side of ['hero', 'villain'] as const) {
      const player = state.players[side];
      expect(player.hand).toHaveLength(3);
      expect(player.deck).toHaveLength(46);
      expect(player.homeFront).toEqual([player.startingCharacter]);
    }
    expect(state.cards[state.players.hero.startingCharacter]?.cardId).toBe('rand');
    expect(state.dominant).toBe('villain');
    expect(state.step).toEqual({
      kind: 'eventWindow',
      point: 'readyRound',
      priority: 'villain',
      passes: 0,
    });
  });

  it('refuses an illegal deck or a deck in the wrong seat', () => {
    const short = { ...makeDeck('rand', 'pelivar'), entries: [{ cardId: 'rand', count: 1 }] };
    const illegal = createGame(
      { hero: short, villain: makeDeck('ishamael', 'trollocs'), seed: [1] },
      CARDS_BY_ID,
    );
    expect(illegal).toMatchObject({
      ok: false,
      error: expect.stringMatching(/Hero deck is not legal/),
    });

    const swapped = createGame(
      { hero: makeDeck('ishamael', 'trollocs'), villain: makeDeck('rand', 'pelivar'), seed: [1] },
      CARDS_BY_ID,
    );
    expect(swapped).toMatchObject({ ok: false });
  });

  it('shuffles the same way from the same seed', () => {
    expect(start([3]).players.hero.deck).toEqual(start([3]).players.hero.deck);
    expect(start([3]).players.hero.deck).not.toEqual(start([4]).players.hero.deck);
  });
});

describe('the turn sequence', () => {
  it('plays a quiet turn: a neutral Pattern token, then two cards each', () => {
    const state = playUntil(start(), PASSIVE, (game) => game.turn === 2);
    expect(state.pattern).toEqual({ hero: 2, villain: 2, neutral: 1 });
    expect(state.players.hero.hand).toHaveLength(5);
    expect(state.players.villain.hand).toHaveLength(5);
    expect(state.step).toMatchObject({ kind: 'eventWindow', point: 'readyRound' });
  });

  it('rolls dice in challenges, deterministically from the seed', () => {
    // Sending everything into the Pattern Challenge can kill a starting
    // character, which ends the game before turn 4.
    function done(game: GameState): boolean {
      return game.turn === 4 || game.step.kind === 'gameOver';
    }
    const first = playUntil(start([11]), AGGRESSIVE, done);
    const second = playUntil(start([11]), AGGRESSIVE, done);
    expect(first).toEqual(second);
    expect(first.log.some((entry) => /rotates and rolls/.test(entry.text))).toBe(true);
    const placed = first.log.filter((entry) => /A token is placed/.test(entry.text)).length;
    expect(placed).toBeGreaterThan(0);
    expect(first.pattern.hero + first.pattern.villain + first.pattern.neutral).toBe(4 + placed);
  });

  it('gives the dominant player the first chance at events and closes after two passes', () => {
    let state = start();
    const event = inHand(state, 'hero', 'hero-event');
    const play: GameAction = { type: 'playEvent', side: 'hero', instanceId: event, symbolIds: [] };
    expect(applyAction(state, play, CARDS_BY_ID)).toMatchObject({ ok: false });

    state = act(state, { type: 'pass', side: 'villain' });
    state = act(state, play);
    expect(state.players.hero.discard).toContain(event);
    expect(state.step).toMatchObject({ kind: 'eventWindow', priority: 'villain', passes: 0 });

    state = act(state, { type: 'pass', side: 'villain' });
    state = act(state, { type: 'pass', side: 'hero' });
    expect(state.step).toEqual({ kind: 'declareChallenges', declarations: {} });
  });
});

describe('hidden information', () => {
  it("keeps the other player's hand, deck and face-down challenge out of a view", () => {
    let state = playUntil(start(), PASSIVE, (game) => game.step.kind === 'declareChallenges');
    const challenge = inHand(state, 'hero', 'hero-challenge');
    state = act(state, {
      type: 'declareChallenge',
      side: 'hero',
      declaration: { kind: 'card', instanceId: challenge },
    });

    const villain = viewFor(state, 'villain');
    expect(villain.step).toEqual({ kind: 'declareChallenges', submitted: ['hero'] });
    expect(villain.players.hero.hand).toBeUndefined();
    expect(villain.players.hero.handSize).toBe(3);
    for (const id of [...state.players.hero.hand, ...state.players.hero.deck]) {
      expect(villain.cards[id]).toBeUndefined();
    }
    expect(villain.log.some((entry) => entry.visibleTo === 'hero')).toBe(false);
    expect(JSON.stringify(villain)).not.toContain('random');

    const hero = viewFor(state, 'hero');
    expect(hero.step).toMatchObject({ own: { kind: 'card', instanceId: challenge } });
    expect(hero.cards[challenge]?.cardId).toBe('hero-challenge');

    state = act(state, {
      type: 'declareChallenge',
      side: 'villain',
      declaration: { kind: 'none' },
    });
    expect(viewFor(state, 'villain').cards[challenge]?.cardId).toBe('hero-challenge');
  });
});

describe('recruiting', () => {
  /**
   * The game at the Hero player's Take Actions step, with Lord Pelivar in hand.
   *
   * @returns The game.
   */
  function heroTakingActions(): GameState {
    const state = playUntil(
      start(),
      PASSIVE,
      (game) => game.step.kind === 'takeActions' && game.step.side === 'hero',
    );
    return act(state, {
      type: 'manual',
      side: 'hero',
      change: { kind: 'searchDeck', cardId: 'pelivar' },
    });
  }

  /**
   * Add symbols to the Hero player's pool and return their ids.
   *
   * @param state - The game.
   * @param track - Which ability.
   * @param count - How many.
   * @param allegiance - Their one allegiance.
   * @returns The game and the new symbol ids.
   */
  function addSymbols(
    state: GameState,
    track: 'politics' | 'combat',
    count: number,
    allegiance: 'Andor' | 'Dragon',
  ): { state: GameState; ids: string[] } {
    const before = new Set(state.players.hero.pool.map((symbol) => symbol.id));
    const next = act(state, {
      type: 'manual',
      side: 'hero',
      change: { kind: 'addSymbols', track, count, allegiances: [allegiance] },
    });
    return {
      state: next,
      ids: next.players.hero.pool.map((symbol) => symbol.id).filter((id) => !before.has(id)),
    };
  }

  it('recruits for the printed cost with matching symbols', () => {
    let state = heroTakingActions();
    const pelivar = inHand(state, 'hero', 'pelivar');
    const politics = addSymbols(state, 'politics', 2, 'Andor');
    const combat = addSymbols(politics.state, 'combat', 1, 'Andor');
    state = act(combat.state, {
      type: 'recruit',
      side: 'hero',
      instanceId: pelivar,
      symbolIds: [...politics.ids, ...combat.ids],
      patternConversions: 0,
    });
    expect(state.players.hero.homeFront).toContain(pelivar);
    expect(state.players.hero.pool).toEqual([]);
  });

  it('doubles the cost for symbols without the allegiance, after converting Pattern', () => {
    let state = heroTakingActions();
    const pelivar = inHand(state, 'hero', 'pelivar');
    const politics = addSymbols(state, 'politics', 2, 'Dragon');
    const combat = addSymbols(politics.state, 'combat', 1, 'Dragon');
    const undoubled = applyAction(
      combat.state,
      {
        type: 'recruit',
        side: 'hero',
        instanceId: pelivar,
        symbolIds: [...politics.ids, ...combat.ids],
        patternConversions: 0,
      },
      CARDS_BY_ID,
    );
    expect(undoubled).toMatchObject({ ok: false });

    state = act(combat.state, {
      type: 'recruit',
      side: 'hero',
      instanceId: pelivar,
      symbolIds: politics.ids,
      patternConversions: 1,
    });
    expect(state.players.hero.homeFront).toContain(pelivar);
    expect(state.pattern).toMatchObject({ hero: 1, neutral: 1 });
  });

  it('refuses to recruit outside the Take Actions step', () => {
    const state = start();
    const result = applyAction(
      state,
      {
        type: 'recruit',
        side: 'hero',
        instanceId: inHand(state, 'hero', 'hero-event'),
        symbolIds: [],
        patternConversions: 0,
      },
      CARDS_BY_ID,
    );
    expect(result).toMatchObject({ ok: false });
  });
});

describe('winning and losing', () => {
  it('begins the Last Battle once the Pattern reaches 20 and ends it on a win by 5', () => {
    let state = start();
    for (let token = 0; token < 16; token += 1) {
      state = act(state, {
        type: 'manual',
        side: 'hero',
        change: { kind: 'pattern', from: 'supply', to: 'hero' },
      });
    }
    expect(state.lastBattlePending).toBe(true);

    const policies = { hero: aggressive, villain: passive };
    state = playUntil(
      state,
      policies,
      (game) =>
        game.lastBattleStartTurn !== undefined &&
        game.step.kind === 'eventWindow' &&
        game.step.point === 'challengeRound',
    );
    const lastBattle = state.challenges[0];
    expect(lastBattle).toMatchObject({ kind: 'lastBattle', initiator: 'hero' });
    expect(state.players.villain.homeFront).toEqual([]);
    expect(state.players.villain.battleground).toContain(state.players.villain.startingCharacter);

    state = act(state, {
      type: 'manual',
      side: 'hero',
      change: {
        kind: 'challengeTotals',
        challengeId: lastBattle?.id ?? '',
        support: 5,
        opposition: 0,
      },
    });
    state = playUntil(state, policies, (game) => game.step.kind === 'gameOver');
    expect(state.step).toEqual({ kind: 'gameOver', winner: 'hero', losers: ['villain'] });
  });

  it('ends the game when a starting character is killed', () => {
    let state = start();
    state = act(state, {
      type: 'manual',
      side: 'hero',
      change: {
        kind: 'moveCard',
        instanceId: state.players.villain.startingCharacter,
        to: 'killed',
      },
    });
    state = playUntil(state, PASSIVE, (game) => game.step.kind === 'gameOver');
    expect(state.step).toEqual({ kind: 'gameOver', winner: 'hero', losers: ['villain'] });
    expect(applyAction(state, { type: 'pass', side: 'hero' }, CARDS_BY_ID)).toEqual({
      ok: false,
      error: 'The game is over.',
    });
  });
});

describe('manual changes', () => {
  it('log for both players and refuse changes that would break the state', () => {
    let state = start();
    const rand = state.players.hero.startingCharacter;
    expect(
      applyAction(
        state,
        {
          type: 'manual',
          side: 'villain',
          change: { kind: 'damage', instanceId: rand, delta: -1 },
        },
        CARDS_BY_ID,
      ),
    ).toMatchObject({ ok: false });

    state = act(state, {
      type: 'manual',
      side: 'villain',
      change: { kind: 'damage', instanceId: rand, delta: 2 },
    });
    expect(state.cards[rand]?.damage).toBe(2);
    const line = /adds 2 damage to Rand al'Thor/;
    expect(viewFor(state, 'hero').log.some((entry) => line.test(entry.text))).toBe(true);
    expect(viewFor(state, 'villain').log.some((entry) => line.test(entry.text))).toBe(true);
  });

  it('keeps a hidden card hidden when it moves between hand and deck', () => {
    let state = start();
    const event = inHand(state, 'hero', 'hero-event');
    state = act(state, {
      type: 'manual',
      side: 'hero',
      change: { kind: 'moveCard', instanceId: event, to: 'deckTop' },
    });
    expect(state.players.hero.deck[0]).toBe(event);
    const villainLog = viewFor(state, 'villain')
      .log.map((entry) => entry.text)
      .join(' ');
    expect(villainLog).not.toContain('Sudden Twist');
    const heroLog = viewFor(state, 'hero')
      .log.map((entry) => entry.text)
      .join(' ');
    expect(heroLog).toContain('Sudden Twist');
  });
});
