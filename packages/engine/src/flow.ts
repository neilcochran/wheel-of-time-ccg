/**
 * The turn sequence: everything that happens between players' decisions.
 *
 * Each exported function finishes one part of the turn and moves on to the
 * next decision, running automatic steps on the way. A decision nobody can
 * make, such as placing forces with an empty home front, is skipped.
 */

import { ABILITY_TRACKS } from '@wot/cards';
import type { AbilityTrack } from '@wot/cards';

import {
  LAST_BATTLE_TRACKS,
  NO_MODIFIERS,
  currentAbility,
  hasTrait,
  isMortallyWounded,
} from './cardRules.ts';
import { describeCost } from './cost.ts';
import type { DeckSide } from './deck/rules.ts';
import { EMPTY_TALLY, rollDice } from './dice.ts';
import type { DiceTally } from './dice.ts';
import type {
  CardLookup,
  Challenge,
  Commitment,
  EventWindowPoint,
  GameState,
  ResolutionStage,
  ResourceSymbol,
} from './state.ts';
import {
  CARDS_DRAWN_PER_TURN,
  PLAYER_NAMES,
  SIDES,
  actingOrder,
  cardOf,
  challengeName,
  changePattern,
  controllerOf,
  drawCards,
  findChallenge,
  forcesOf,
  inPlayIds,
  maxHandSize,
  moveCard,
  nameOf,
  opponentOf,
  participantsOf,
  subordinateSide,
  takeId,
  updateChallenge,
  updateInstance,
  updatePlayer,
  withLog,
  withoutParticipation,
} from './stateOps.ts';

/** Margin by which the Pattern Challenge places a token on a player's section. */
const PATTERN_MARGIN = 3;

/** Margin by which a Last Battle challenge is won. */
const LAST_BATTLE_MARGIN = 5;

/**
 * Whether the Last Battle has started.
 *
 * @param state - The game.
 * @returns True from the first Last Battle turn on.
 */
export function isLastBattle(state: GameState): boolean {
  return state.lastBattleStartTurn !== undefined;
}

/**
 * The abilities cards roll in challenges right now.
 *
 * @param state - The game.
 * @returns Every ability, or all but Politics in the Last Battle.
 */
export function challengeTracks(state: GameState): readonly AbilityTrack[] {
  return isLastBattle(state) ? LAST_BATTLE_TRACKS : ABILITY_TRACKS;
}

/**
 * Add two tallies.
 *
 * @param a - One tally.
 * @param b - The other.
 * @returns The sum.
 */
function addTallies(a: DiceTally, b: DiceTally): DiceTally {
  return {
    ability: a.ability + b.ability,
    support: a.support + b.support,
    opposition: a.opposition + b.opposition,
    damage: a.damage + b.damage,
  };
}

/** A card's roll and the game after it. */
export interface RollResult {
  /** The game with the card rotated, symbols pooled and the dice used. */
  readonly state: GameState;
  /** Everything the dice produced. */
  readonly tally: DiceTally;
}

/**
 * Rotate a card and roll one die per point of each current ability, adding
 * any ability symbols to its controller's pool.
 *
 * @param state - The game.
 * @param cards - The card database.
 * @param instanceId - The card in play.
 * @param tracks - The abilities to roll.
 * @param inChallenge - Whether support, opposition and damage count, which decides what the log reports.
 * @returns The game and the tally.
 */
export function rotateAndRoll(
  state: GameState,
  cards: CardLookup,
  instanceId: string,
  tracks: readonly AbilityTrack[],
  inChallenge: boolean,
): RollResult {
  const instance = state.cards[instanceId];
  const card = cardOf(state, cards, instanceId);
  const controller = controllerOf(state, instanceId);
  if (instance === undefined || card === undefined || controller === undefined) {
    return { state, tally: EMPTY_TALLY };
  }

  let next = updateInstance(state, instanceId, (current) => ({ ...current, rotated: true }));
  let tally = EMPTY_TALLY;
  const dice = { politics: 0, intrigue: 0, onePower: 0, combat: 0 };
  const produced = { politics: 0, intrigue: 0, onePower: 0, combat: 0 };
  const symbols: ResourceSymbol[] = [];
  for (const track of tracks) {
    const count = currentAbility(instance, card, track);
    if (count === 0) {
      continue;
    }
    const roll = rollDice(next.random, track, count);
    next = { ...next, random: roll.state };
    tally = addTallies(tally, roll.value);
    dice[track] = count;
    produced[track] = roll.value.ability;
    for (let symbol = 0; symbol < roll.value.ability; symbol += 1) {
      const taken = takeId(next, 'symbol-');
      next = taken.state;
      symbols.push({ id: taken.id, track, source: { kind: 'card', instanceId } });
    }
  }
  next = updatePlayer(next, controller, (player) => ({
    ...player,
    pool: [...player.pool, ...symbols],
  }));

  const rolled = `${card.name} rotates and rolls ${describeCost(dice)} dice`;
  const text = inChallenge
    ? `${rolled}: ${describeCost(produced)} in symbols, ${tally.support} support, ${tally.opposition} opposition and ${tally.damage} damage.`
    : `${rolled}, generating ${describeCost(produced)}.`;
  return { state: withLog(next, text), tally };
}

/**
 * Open an event window, the dominant player first.
 *
 * @param state - The game.
 * @param point - Where in the turn the window is.
 * @param challengeId - The challenge being resolved, for windows inside a resolution.
 * @returns The game waiting on the dominant player to play an event or pass.
 */
export function openEventWindow(
  state: GameState,
  point: EventWindowPoint,
  challengeId?: string,
): GameState {
  const base = { kind: 'eventWindow', point, priority: state.dominant, passes: 0 } as const;
  return { ...state, step: challengeId === undefined ? base : { ...base, challengeId } };
}

/**
 * Begin a turn: ready every card, bring forces home, start the Last Battle if
 * it is due, and determine dominance.
 *
 * @param state - The game.
 * @param turn - The new turn's number.
 * @returns The game at its next decision.
 */
export function beginTurn(state: GameState, turn: number): GameState {
  let next: GameState = { ...state, turn, challenges: [] };
  for (const side of SIDES) {
    next = updatePlayer(next, side, (player) => ({
      ...player,
      homeFront: [...player.homeFront, ...player.battleground],
      battleground: [],
      pool: [],
    }));
    for (const id of inPlayIds(next, side)) {
      next = updateInstance(next, id, (instance) =>
        withoutParticipation({ ...instance, rotated: false, turnModifiers: NO_MODIFIERS }),
      );
    }
  }
  next = withLog(next, `Turn ${turn} begins. Every card is readied and every force returns home.`);

  if (next.lastBattlePending && next.lastBattleStartTurn === undefined) {
    next = withLog(
      { ...next, lastBattlePending: false, lastBattleStartTurn: turn },
      'The Pattern has reached 20 tokens. The Last Battle begins.',
    );
    const holder = SIDES.find((side) => next.players[side].faceDownDragonReborn !== undefined);
    if (holder !== undefined) {
      return { ...next, step: { kind: 'revealDragonReborn', side: holder } };
    }
  }
  return determineDominance(next);
}

/**
 * Determine dominance: the player with more tokens on their section of the
 * Pattern, the Villain player on a tie.
 *
 * @param state - The game.
 * @returns The game at the Ready Round's event window.
 */
export function determineDominance(state: GameState): GameState {
  const dominant: DeckSide = state.pattern.hero > state.pattern.villain ? 'hero' : 'villain';
  const next = withLog({ ...state, dominant }, `${PLAYER_NAMES[dominant]} is dominant this turn.`);
  return openEventWindow(next, 'readyRound');
}

/**
 * Close an event window and carry on from where it was.
 *
 * @param state - The game, at an event window.
 * @param cards - The card database.
 * @returns The game at its next decision.
 */
export function closeEventWindow(state: GameState, cards: CardLookup): GameState {
  const step = state.step;
  if (step.kind !== 'eventWindow') {
    return state;
  }
  switch (step.point) {
    case 'readyRound':
      return beginChallengeRound(state);
    case 'challengeRound':
      return isLastBattle(state)
        ? beginNextResolution(state, cards)
        : beginActionRound(state, cards);
    case 'actionRound':
      return beginNextResolution(
        SIDES.reduce((next, side) => updatePlayer(next, side, (p) => ({ ...p, pool: [] })), state),
        cards,
      );
    case 'openingMoves':
      return step.challengeId === undefined
        ? state
        : beginRollers(state, cards, step.challengeId, 'comingToGrips');
    case 'comingToGrips':
      return step.challengeId === undefined
        ? state
        : resolveOutcome(state, cards, step.challengeId);
    case 'drawRound':
      return beginTurn(state, state.turn + 1);
  }
}

/**
 * Add a challenge to the turn.
 *
 * @param state - The game.
 * @param fields - The challenge's kind, initiator and card or advantage.
 * @returns The game with the challenge added last.
 */
function addChallenge(
  state: GameState,
  fields: Omit<Challenge, 'id' | 'support' | 'opposition' | 'outcome'>,
): GameState {
  const taken = takeId(state, 'challenge-');
  const challenge: Challenge = { ...fields, id: taken.id, support: 0, opposition: 0 };
  return { ...taken.state, challenges: [...taken.state.challenges, challenge] };
}

/**
 * Begin the Challenge Round.
 *
 * @param state - The game.
 * @returns The game waiting on challenge declarations, or in the Last Battle on participation.
 */
function beginChallengeRound(state: GameState): GameState {
  if (state.lastBattleStartTurn !== undefined) {
    const initiator: DeckSide =
      (state.turn - state.lastBattleStartTurn) % 2 === 0 ? 'hero' : 'villain';
    let next = addChallenge(state, { kind: 'lastBattle', initiator });
    for (const side of SIDES) {
      next = updatePlayer(next, side, (player) => ({
        ...player,
        battleground: [...player.battleground, ...player.homeFront],
        homeFront: [],
      }));
    }
    next = withLog(
      next,
      `${PLAYER_NAMES[initiator]} initiates the Last Battle challenge. Every character and troop goes to the battleground.`,
    );
    return settleParticipation(next, autoCommitments(next));
  }
  const next = withLog(
    addChallenge(state, { kind: 'pattern', initiator: 'hero' }),
    'The Hero player initiates the Pattern Challenge.',
  );
  return { ...next, step: { kind: 'declareChallenges', declarations: {} } };
}

/**
 * Reveal both players' challenge declarations and add their challenges.
 *
 * @param state - The game, with both declarations in.
 * @param cards - The card database.
 * @returns The game at Place Forces.
 */
export function revealChallenges(state: GameState, cards: CardLookup): GameState {
  const step = state.step;
  if (step.kind !== 'declareChallenges') {
    return state;
  }
  let next = state;
  for (const side of actingOrder(state)) {
    const declaration = step.declarations[side];
    if (declaration === undefined || declaration.kind === 'none') {
      next = withLog(next, `${PLAYER_NAMES[side]} declares no challenge.`);
    } else if (declaration.kind === 'card') {
      const name = nameOf(next, cards, declaration.instanceId);
      next = updatePlayer(next, side, (player) => ({
        ...player,
        hand: player.hand.filter((id) => id !== declaration.instanceId),
      }));
      next = addChallenge(next, {
        kind: 'card',
        initiator: side,
        cardInstanceId: declaration.instanceId,
      });
      next = withLog(next, `${PLAYER_NAMES[side]} reveals the challenge ${name}.`);
    } else {
      next = addChallenge(next, {
        kind: 'contested',
        initiator: side,
        advantageInstanceId: declaration.advantageInstanceId,
      });
      next = withLog(
        next,
        `${PLAYER_NAMES[side]} contests control of ${nameOf(next, cards, declaration.advantageInstanceId)}.`,
      );
    }
  }
  return beginPlaceForces(next, subordinateSide(next));
}

/**
 * Ask a player to place forces, or skip them if their home front is empty.
 *
 * @param state - The game.
 * @param side - The player.
 * @returns The game at its next decision.
 */
function beginPlaceForces(state: GameState, side: DeckSide): GameState {
  if (state.players[side].homeFront.length === 0) {
    return finishPlaceForces(state, side);
  }
  return { ...state, step: { kind: 'placeForces', side } };
}

/**
 * Move on once a player has placed forces.
 *
 * @param state - The game.
 * @param side - The player who has finished.
 * @returns The game at its next decision.
 */
export function finishPlaceForces(state: GameState, side: DeckSide): GameState {
  return side === subordinateSide(state)
    ? beginPlaceForces(state, state.dominant)
    : settleParticipation(state, autoCommitments(state));
}

/**
 * Empty commitments for players with nothing in the battleground.
 *
 * @param state - The game.
 * @returns The commitments that need no decision.
 */
function autoCommitments(state: GameState): Partial<Record<DeckSide, readonly Commitment[]>> {
  const commitments: Partial<Record<DeckSide, readonly Commitment[]>> = {};
  for (const side of SIDES) {
    if (state.players[side].battleground.length === 0) {
      commitments[side] = [];
    }
  }
  return commitments;
}

/**
 * Record participation, applying it once both players have committed.
 *
 * @param state - The game.
 * @param commitments - Commitments so far.
 * @returns The game waiting on the other player, or at the Challenge Round's event window.
 */
export function settleParticipation(
  state: GameState,
  commitments: Partial<Record<DeckSide, readonly Commitment[]>>,
): GameState {
  const hero = commitments.hero;
  const villain = commitments.villain;
  if (hero === undefined || villain === undefined) {
    return { ...state, step: { kind: 'determineParticipation', commitments } };
  }
  let next = state;
  for (const [side, list] of [
    ['hero', hero],
    ['villain', villain],
  ] as const) {
    for (const commitment of list) {
      next = updateInstance(next, commitment.instanceId, (instance) => ({
        ...instance,
        challengeId: commitment.challengeId,
      }));
    }
    const standing = next.players[side].battleground.length - list.length;
    next = withLog(
      next,
      `${PLAYER_NAMES[side]} commits ${list.length} card${list.length === 1 ? '' : 's'} to challenges; ${standing} stand${standing === 1 ? 's' : ''} down.`,
    );
  }
  return openEventWindow(next, 'challengeRound');
}

/**
 * Begin the Action Round.
 *
 * @param state - The game.
 * @param cards - The card database.
 * @returns The game at its next decision.
 */
function beginActionRound(state: GameState, cards: CardLookup): GameState {
  return beginGenerate(withLog(state, 'The Action Round begins.'), cards, subordinateSide(state));
}

/**
 * The home front characters a player can still rotate to generate symbols.
 *
 * @param state - The game.
 * @param cards - The card database.
 * @param side - The player.
 * @returns Ready characters with at least one ability above zero.
 */
export function generateEligible(
  state: GameState,
  cards: CardLookup,
  side: DeckSide,
): readonly string[] {
  return state.players[side].homeFront.filter((id) => {
    const instance = state.cards[id];
    const card = cardOf(state, cards, id);
    return (
      instance !== undefined &&
      card?.type === 'Character' &&
      !instance.rotated &&
      ABILITY_TRACKS.some((track) => currentAbility(instance, card, track) > 0)
    );
  });
}

/**
 * Ask a player to generate symbols, or skip them if they have no character to roll.
 *
 * @param state - The game.
 * @param cards - The card database.
 * @param side - The player.
 * @returns The game at its next decision.
 */
function beginGenerate(state: GameState, cards: CardLookup, side: DeckSide): GameState {
  if (generateEligible(state, cards, side).length === 0) {
    return finishGenerate(state, cards, side);
  }
  return { ...state, step: { kind: 'generateResources', side } };
}

/**
 * Move on once a player has finished generating symbols.
 *
 * @param state - The game.
 * @param cards - The card database.
 * @param side - The player who has finished.
 * @returns The game at its next decision.
 */
export function finishGenerate(state: GameState, cards: CardLookup, side: DeckSide): GameState {
  return side === subordinateSide(state)
    ? beginGenerate(state, cards, state.dominant)
    : { ...state, step: { kind: 'takeActions', side: subordinateSide(state) } };
}

/**
 * Move on once a player has finished taking actions.
 *
 * @param state - The game.
 * @param side - The player who has finished.
 * @returns The game at its next decision.
 */
export function finishActions(state: GameState, side: DeckSide): GameState {
  return side === subordinateSide(state)
    ? { ...state, step: { kind: 'takeActions', side: state.dominant } }
    : openEventWindow(state, 'actionRound');
}

/**
 * Resolve the next unresolved challenge, or begin the Draw Round when none remain.
 *
 * @param state - The game.
 * @param cards - The card database.
 * @returns The game at its next decision.
 */
function beginNextResolution(state: GameState, cards: CardLookup): GameState {
  const challenge = state.challenges.find((candidate) => candidate.outcome === undefined);
  if (challenge === undefined) {
    return beginDrawRound(state, cards);
  }
  const next = withLog(state, `Resolving ${challengeName(state, cards, challenge)}.`);
  return beginRollers(next, cards, challenge.id, 'openingMoves');
}

/**
 * The participants a player may rotate to roll in a stage.
 *
 * @param state - The game.
 * @param cards - The card database.
 * @param challengeId - The challenge.
 * @param stage - Characters roll in Opening Moves, troops in Coming to Grips.
 * @param side - The player.
 * @returns Ready participants of the stage's type with dice to roll.
 */
export function rollerEligible(
  state: GameState,
  cards: CardLookup,
  challengeId: string,
  stage: ResolutionStage,
  side: DeckSide,
): readonly string[] {
  const wanted = stage === 'openingMoves' ? 'Character' : 'Troop';
  const tracks = challengeTracks(state);
  return participantsOf(state, challengeId, side).filter((id) => {
    const instance = state.cards[id];
    const card = cardOf(state, cards, id);
    return (
      instance !== undefined &&
      card?.type === wanted &&
      !instance.rotated &&
      tracks.some((track) => currentAbility(instance, card, track) > 0)
    );
  });
}

/**
 * Ask players which participants roll in a stage, skipping players with none.
 *
 * @param state - The game.
 * @param cards - The card database.
 * @param challengeId - The challenge.
 * @param stage - The stage.
 * @returns The game at its next decision.
 */
function beginRollers(
  state: GameState,
  cards: CardLookup,
  challengeId: string,
  stage: ResolutionStage,
): GameState {
  const rollers: Partial<Record<DeckSide, readonly string[]>> = {};
  for (const side of SIDES) {
    if (rollerEligible(state, cards, challengeId, stage, side).length === 0) {
      rollers[side] = [];
    }
  }
  return settleRollers(state, cards, challengeId, stage, rollers);
}

/**
 * Record roller announcements, rolling once both players have announced.
 *
 * @param state - The game.
 * @param cards - The card database.
 * @param challengeId - The challenge.
 * @param stage - The stage.
 * @param rollers - Announcements so far.
 * @returns The game at its next decision.
 */
export function settleRollers(
  state: GameState,
  cards: CardLookup,
  challengeId: string,
  stage: ResolutionStage,
  rollers: Partial<Record<DeckSide, readonly string[]>>,
): GameState {
  const hero = rollers.hero;
  const villain = rollers.villain;
  if (hero === undefined || villain === undefined) {
    return { ...state, step: { kind: 'declareRollers', challengeId, stage, rollers } };
  }

  let next = state;
  const generatedDamage = { hero: 0, villain: 0 };
  const announced = { hero, villain };
  for (const side of actingOrder(state)) {
    for (const id of announced[side]) {
      const challenge = findChallenge(next, challengeId);
      if (challenge === undefined) {
        return next;
      }
      const roll = rotateAndRoll(next, cards, id, challengeTracks(next), true);
      const supporting = side === challenge.initiator;
      next = updateChallenge(roll.state, challengeId, (current) => ({
        ...current,
        support: current.support + (supporting ? roll.tally.support : 0),
        opposition: current.opposition + (supporting ? 0 : roll.tally.opposition),
      }));
      generatedDamage[side] += roll.tally.damage;
    }
  }

  const wanted = stage === 'openingMoves' ? 'Character' : 'Troop';
  const owed = { hero: 0, villain: 0 };
  for (const side of SIDES) {
    const dealt = generatedDamage[opponentOf(side)];
    const targets = participantsOf(next, challengeId, side).filter(
      (id) => cardOf(next, cards, id)?.type === wanted,
    );
    if (dealt > 0 && targets.length === 0) {
      next = withLog(
        next,
        `${PLAYER_NAMES[opponentOf(side)]} generated ${dealt} damage, but no opposing ${wanted.toLowerCase()} is participating, so it is ignored.`,
      );
    }
    owed[side] = targets.length === 0 ? 0 : dealt;
  }
  return beginDamageAssignment(next, challengeId, stage, owed);
}

/**
 * Ask the next player owed damage to place it, subordinate first, or open the
 * stage's event window once all damage is placed.
 *
 * @param state - The game.
 * @param challengeId - The challenge.
 * @param stage - The stage the damage came from.
 * @param owed - Damage each player must still place on their own cards.
 * @returns The game at its next decision.
 */
export function beginDamageAssignment(
  state: GameState,
  challengeId: string,
  stage: ResolutionStage,
  owed: Readonly<Record<DeckSide, number>>,
): GameState {
  const side = actingOrder(state).find((candidate) => owed[candidate] > 0);
  if (side === undefined) {
    return openEventWindow(state, stage, challengeId);
  }
  return { ...state, step: { kind: 'assignDamage', challengeId, stage, side, owed } };
}

/**
 * Determine a challenge's outcome and apply what the rules decide.
 *
 * @param state - The game.
 * @param cards - The card database.
 * @param challengeId - The challenge.
 * @returns The game at its next decision.
 */
function resolveOutcome(state: GameState, cards: CardLookup, challengeId: string): GameState {
  const challenge = findChallenge(state, challengeId);
  if (challenge === undefined) {
    return beginNextResolution(state, cards);
  }
  const name = challengeName(state, cards, challenge);
  const opponent = opponentOf(challenge.initiator);
  let { support, opposition } = challenge;
  let next = state;

  if (challenge.kind === 'lastBattle') {
    const generatedSupport = support;
    const generatedOpposition = opposition;
    support += state.pattern[challenge.initiator];
    opposition += state.pattern[opponent];
    const margin = support - opposition;
    const winner =
      margin >= LAST_BATTLE_MARGIN
        ? challenge.initiator
        : margin <= -LAST_BATTLE_MARGIN
          ? opponent
          : undefined;
    const failedToGenerate: DeckSide[] = [];
    if (generatedSupport === 0 && winner !== challenge.initiator) {
      failedToGenerate.push(challenge.initiator);
    }
    if (generatedOpposition === 0 && winner !== opponent) {
      failedToGenerate.push(opponent);
    }
    next = {
      ...next,
      lastBattleOutcome: winner === undefined ? { failedToGenerate } : { winner, failedToGenerate },
    };
    next = withLog(
      next,
      `With Pattern tokens added, ${name} ends at ${support} support against ${opposition} opposition.${winner === undefined ? ' Nobody wins it by 5.' : ` ${PLAYER_NAMES[winner]} wins it.`}`,
    );
  }

  const margin = support - opposition;
  const succeeded = margin > 0;
  next = updateChallenge(next, challengeId, (current) => ({
    ...current,
    support,
    opposition,
    outcome: { succeeded, margin },
  }));
  if (challenge.kind !== 'lastBattle') {
    next = withLog(
      next,
      `${name} ${succeeded ? 'succeeds' : 'does not succeed'}, ${support} support against ${opposition} opposition.`,
    );
  }

  if (challenge.kind === 'pattern') {
    const section =
      margin >= PATTERN_MARGIN ? 'hero' : margin <= -PATTERN_MARGIN ? 'villain' : 'neutral';
    next = changePattern(next, section, 1);
    const where =
      section === 'neutral'
        ? 'the neutral section'
        : `the ${section === 'hero' ? 'Hero' : 'Villain'} player's section`;
    next = withLog(next, `A token is placed on ${where} of the Pattern.`);
  } else if (challenge.kind === 'contested' && succeeded) {
    const advantageId = challenge.advantageInstanceId;
    const tokens = Math.floor(margin / 2);
    if (advantageId !== undefined && controllerOf(next, advantageId) !== undefined && tokens > 0) {
      next = updateInstance(next, advantageId, (instance) => {
        const current = instance.controlTokens ?? { hero: 0, villain: 0 };
        return {
          ...instance,
          controlTokens: {
            ...current,
            [challenge.initiator]: current[challenge.initiator] + tokens,
          },
        };
      });
      next = withLog(
        next,
        `${PLAYER_NAMES[challenge.initiator]} places ${tokens} control token${tokens === 1 ? '' : 's'} on ${nameOf(next, cards, advantageId)}.`,
      );
    }
  } else if (challenge.kind === 'card' && challenge.cardInstanceId !== undefined) {
    const owner = next.cards[challenge.cardInstanceId]?.owner ?? challenge.initiator;
    next = moveCard(next, challenge.cardInstanceId, owner, 'discard');
  }

  for (const side of SIDES) {
    for (const id of participantsOf(next, challengeId, side)) {
      next = updateInstance(next, id, withoutParticipation);
    }
    next = updatePlayer(next, side, (player) => ({ ...player, pool: [] }));
  }
  return beginNextResolution(next, cards);
}

/**
 * The players who have lost, by the Victory Check.
 *
 * @param state - The game.
 * @param cards - The card database.
 * @returns Every losing side.
 */
function losersOf(state: GameState, cards: CardLookup): DeckSide[] {
  const outcome = state.lastBattleOutcome;
  return SIDES.filter((side) => {
    const player = state.players[side];
    const taverenKilled = player.killed.some((id) => {
      const card = cardOf(state, cards, id);
      return card !== undefined && hasTrait(card, "Ta'veren");
    });
    return (
      player.killed.includes(player.startingCharacter) ||
      taverenKilled ||
      outcome?.winner === opponentOf(side) ||
      (outcome?.failedToGenerate.includes(side) ?? false)
    );
  });
}

/**
 * Begin the Draw Round: discard the dead and check for victory.
 *
 * @param state - The game.
 * @param cards - The card database.
 * @returns The game waiting on discards, or over.
 */
function beginDrawRound(state: GameState, cards: CardLookup): GameState {
  let next = withLog(state, 'The Draw Round begins.');
  for (const side of SIDES) {
    for (const id of forcesOf(next, side)) {
      const instance = next.cards[id];
      const card = cardOf(next, cards, id);
      if (instance !== undefined && card !== undefined && isMortallyWounded(instance, card)) {
        next = withLog(
          moveCard(next, id, instance.owner, 'killed'),
          `${card.name} is mortally wounded and is killed.`,
        );
      }
    }
  }

  const losers = losersOf(next, cards);
  const { lastBattleOutcome: _, ...cleared } = next;
  next = cleared;
  if (losers.length > 0) {
    const loser = losers.length === 1 ? losers[0] : undefined;
    if (loser === undefined) {
      return withLog(
        { ...next, step: { kind: 'gameOver', losers } },
        'Both players lose the game.',
      );
    }
    const winner = opponentOf(loser);
    return withLog(
      { ...next, step: { kind: 'gameOver', winner, losers } },
      `${PLAYER_NAMES[winner]} wins the game.`,
    );
  }
  return { ...next, step: { kind: 'discardDown', discards: {} } };
}

/**
 * Record discards, and once both players have chosen, discard and draw.
 *
 * @param state - The game.
 * @param cards - The card database.
 * @param discards - Discards so far.
 * @returns The game waiting on the other player, or at the Draw Round's event window.
 */
export function settleDiscards(
  state: GameState,
  cards: CardLookup,
  discards: Partial<Record<DeckSide, readonly string[]>>,
): GameState {
  const hero = discards.hero;
  const villain = discards.villain;
  if (hero === undefined || villain === undefined) {
    return { ...state, step: { kind: 'discardDown', discards } };
  }

  let next = state;
  const chosen = { hero, villain };
  for (const side of actingOrder(state)) {
    const list = chosen[side];
    if (list.length > 0) {
      const names = list.map((id) => nameOf(next, cards, id)).join(', ');
      for (const id of list) {
        next = moveCard(next, id, side, 'discard');
      }
      next = withLog(next, `${PLAYER_NAMES[side]} discards ${names}.`);
    }
  }
  for (const side of actingOrder(state)) {
    const player = next.players[side];
    const count = Math.max(
      0,
      Math.min(CARDS_DRAWN_PER_TURN, maxHandSize(player) - player.hand.length),
    );
    const draw = drawCards(next, side, count);
    next = withLog(
      draw.state,
      `${PLAYER_NAMES[side]} draws ${draw.drawn.length} card${draw.drawn.length === 1 ? '' : 's'}.`,
    );
    if (draw.drawn.length > 0) {
      next = withLog(
        next,
        `You draw ${draw.drawn.map((id) => nameOf(next, cards, id)).join(', ')}.`,
        side,
      );
    }
  }
  return openEventWindow(next, 'drawRound');
}
