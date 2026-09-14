/**
 * Small immutable operations on the game state shared by the turn sequence
 * and the actions: finding and moving cards, logging, ids, drawing and the
 * Pattern.
 */

import type { Card } from '@wot/cards';

import { NO_MODIFIERS } from './cardRules.ts';
import type { DeckSide } from './deck/rules.ts';
import type {
  CardInstance,
  CardLookup,
  Challenge,
  GameState,
  PatternSection,
  PlayerState,
} from './state.ts';

/** Both sides, Hero first. */
export const SIDES: readonly DeckSide[] = ['hero', 'villain'];

/** How each player is named in the log. */
export const PLAYER_NAMES: Readonly<Record<DeckSide, string>> = {
  hero: 'The Hero player',
  villain: 'The Villain player',
};

/** Tokens on the Pattern that bring on the Last Battle. */
export const LAST_BATTLE_PATTERN = 20;

/** Maximum hand size before card text changes it. */
export const BASE_HAND_SIZE = 8;

/** Cards each player draws in the Draw Cards step. */
export const CARDS_DRAWN_PER_TURN = 2;

/** The zones each player holds cards in. */
export const PLAYER_ZONES = [
  'deck',
  'hand',
  'discard',
  'killed',
  'removed',
  'homeFront',
  'battleground',
  'advantages',
] as const;

/** A zone a player holds cards in. */
export type PlayerZone = (typeof PLAYER_ZONES)[number];

/** Where a card is. */
export type CardLocation =
  | {
      /** Discriminator. In one of a player's zones. */
      readonly kind: 'zone';
      /** The player holding the zone. */
      readonly side: DeckSide;
      /** The zone. */
      readonly zone: PlayerZone;
    }
  | {
      /** Discriminator. A face-down Dragon Reborn. */
      readonly kind: 'faceDown';
      /** The player holding it. */
      readonly side: DeckSide;
    }
  | {
      /** Discriminator. A challenge card waiting to be resolved. */
      readonly kind: 'challenge';
      /** The challenge. */
      readonly challengeId: string;
    };

/**
 * Whether a zone is in play.
 *
 * @param zone - The zone.
 * @returns True for the home front, battleground and advantages.
 */
export function isInPlayZone(zone: PlayerZone): boolean {
  return zone === 'homeFront' || zone === 'battleground' || zone === 'advantages';
}

/**
 * The other side.
 *
 * @param side - A side.
 * @returns Its opponent.
 */
export function opponentOf(side: DeckSide): DeckSide {
  return side === 'hero' ? 'villain' : 'hero';
}

/**
 * The subordinate player for the turn.
 *
 * @param state - The game.
 * @returns The side that is not dominant.
 */
export function subordinateSide(state: GameState): DeckSide {
  return opponentOf(state.dominant);
}

/**
 * The order players act in steps that are not simultaneous.
 *
 * @param state - The game.
 * @returns The subordinate player, then the dominant player.
 */
export function actingOrder(state: GameState): readonly DeckSide[] {
  return [subordinateSide(state), state.dominant];
}

/**
 * The first player, in acting order, who has not yet submitted a choice.
 *
 * @param state - The game.
 * @param submissions - Choices so far, by side.
 * @returns The side still to choose, or undefined when both have.
 */
export function firstPending(
  state: GameState,
  submissions: Partial<Record<DeckSide, unknown>>,
): DeckSide | undefined {
  return actingOrder(state).find((side) => submissions[side] === undefined);
}

/**
 * Find a card.
 *
 * @param state - The game.
 * @param instanceId - The card.
 * @returns Where it is, or undefined for an unknown id.
 */
export function locate(state: GameState, instanceId: string): CardLocation | undefined {
  for (const side of SIDES) {
    const player = state.players[side];
    for (const zone of PLAYER_ZONES) {
      if (player[zone].includes(instanceId)) {
        return { kind: 'zone', side, zone };
      }
    }
    if (player.faceDownDragonReborn === instanceId) {
      return { kind: 'faceDown', side };
    }
  }
  const challenge = state.challenges.find((candidate) => candidate.cardInstanceId === instanceId);
  return challenge === undefined ? undefined : { kind: 'challenge', challengeId: challenge.id };
}

/**
 * The player controlling a card in play.
 *
 * @param state - The game.
 * @param instanceId - The card.
 * @returns The controller, or undefined when the card is not in play.
 */
export function controllerOf(state: GameState, instanceId: string): DeckSide | undefined {
  const location = locate(state, instanceId);
  return location?.kind === 'zone' && isInPlayZone(location.zone) ? location.side : undefined;
}

/**
 * The card data for an instance.
 *
 * @param state - The game.
 * @param cards - The card database.
 * @param instanceId - The card.
 * @returns The card, or undefined for an unknown id.
 */
export function cardOf(state: GameState, cards: CardLookup, instanceId: string): Card | undefined {
  const instance = state.cards[instanceId];
  return instance === undefined ? undefined : cards.get(instance.cardId);
}

/**
 * A card's name for the log.
 *
 * @param state - The game.
 * @param cards - The card database.
 * @param instanceId - The card.
 * @returns The name, or a stand-in for an unknown card.
 */
export function nameOf(state: GameState, cards: CardLookup, instanceId: string): string {
  return cardOf(state, cards, instanceId)?.name ?? 'an unknown card';
}

/**
 * A challenge's name for the log.
 *
 * @param state - The game.
 * @param cards - The card database.
 * @param challenge - The challenge.
 * @returns For example "the Pattern Challenge".
 */
export function challengeName(state: GameState, cards: CardLookup, challenge: Challenge): string {
  switch (challenge.kind) {
    case 'pattern':
      return 'the Pattern Challenge';
    case 'lastBattle':
      return 'the Last Battle challenge';
    case 'card':
      return challenge.cardInstanceId === undefined
        ? 'a challenge'
        : nameOf(state, cards, challenge.cardInstanceId);
    case 'contested':
      return challenge.advantageInstanceId === undefined
        ? 'a contested advantage challenge'
        : `the contest for ${nameOf(state, cards, challenge.advantageInstanceId)}`;
  }
}

/**
 * Find a challenge.
 *
 * @param state - The game.
 * @param challengeId - The challenge.
 * @returns The challenge, or undefined for an unknown id.
 */
export function findChallenge(state: GameState, challengeId: string): Challenge | undefined {
  return state.challenges.find((challenge) => challenge.id === challengeId);
}

/**
 * Add a line to the log.
 *
 * @param state - The game.
 * @param text - What happened.
 * @param visibleTo - The only player who may see it, when it reveals hidden information.
 * @returns The game with the line added.
 */
export function withLog(state: GameState, text: string, visibleTo?: DeckSide): GameState {
  const entry =
    visibleTo === undefined ? { turn: state.turn, text } : { turn: state.turn, text, visibleTo };
  return { ...state, log: [...state.log, entry] };
}

/**
 * Change one card instance.
 *
 * @param state - The game.
 * @param instanceId - The card.
 * @param change - Builds the new instance from the old.
 * @returns The game, unchanged for an unknown id.
 */
export function updateInstance(
  state: GameState,
  instanceId: string,
  change: (instance: CardInstance) => CardInstance,
): GameState {
  const instance = state.cards[instanceId];
  if (instance === undefined) {
    return state;
  }
  return { ...state, cards: { ...state.cards, [instanceId]: change(instance) } };
}

/**
 * Change one player.
 *
 * @param state - The game.
 * @param side - The player.
 * @param change - Builds the new player state from the old.
 * @returns The game.
 */
export function updatePlayer(
  state: GameState,
  side: DeckSide,
  change: (player: PlayerState) => PlayerState,
): GameState {
  return { ...state, players: { ...state.players, [side]: change(state.players[side]) } };
}

/**
 * Change one challenge.
 *
 * @param state - The game.
 * @param challengeId - The challenge.
 * @param change - Builds the new challenge from the old.
 * @returns The game.
 */
export function updateChallenge(
  state: GameState,
  challengeId: string,
  change: (challenge: Challenge) => Challenge,
): GameState {
  return {
    ...state,
    challenges: state.challenges.map((challenge) =>
      challenge.id === challengeId ? change(challenge) : challenge,
    ),
  };
}

/**
 * Take a fresh id.
 *
 * @param state - The game.
 * @param prefix - Text the id starts with.
 * @returns The id and the game with the counter moved on.
 */
export function takeId(
  state: GameState,
  prefix: string,
): { readonly state: GameState; readonly id: string } {
  return { state: { ...state, nextId: state.nextId + 1 }, id: `${prefix}${state.nextId}` };
}

/**
 * A card instance no longer participating in a challenge.
 *
 * @param instance - The instance.
 * @returns The instance without a challenge.
 */
export function withoutParticipation(instance: CardInstance): CardInstance {
  const { challengeId: _, ...rest } = instance;
  return rest;
}

/**
 * Take a card out of wherever it is, leaving it nowhere.
 *
 * @param state - The game.
 * @param instanceId - The card.
 * @returns The game with the card in no zone.
 */
export function detachCard(state: GameState, instanceId: string): GameState {
  const location = locate(state, instanceId);
  if (location === undefined) {
    return state;
  }
  switch (location.kind) {
    case 'zone':
      return updatePlayer(state, location.side, (player) => ({
        ...player,
        [location.zone]: player[location.zone].filter((id) => id !== instanceId),
      }));
    case 'faceDown':
      return updatePlayer(state, location.side, (player) => {
        const { faceDownDragonReborn: _, ...rest } = player;
        return rest;
      });
    case 'challenge':
      return updateChallenge(state, location.challengeId, (challenge) => {
        const { cardInstanceId: _, ...rest } = challenge;
        return rest;
      });
  }
}

/**
 * Discard every advantage attached to a card.
 *
 * @param state - The game.
 * @param instanceId - The card the advantages are on.
 * @returns The game with those advantages in their owners' discard piles.
 */
function discardAttachments(state: GameState, instanceId: string): GameState {
  let next = state;
  for (const side of SIDES) {
    for (const advantageId of state.players[side].advantages) {
      const advantage = state.cards[advantageId];
      if (
        advantage?.attachedTo?.kind === 'card' &&
        advantage.attachedTo.instanceId === instanceId
      ) {
        next = moveCard(next, advantageId, advantage.owner, 'discard');
      }
    }
  }
  return next;
}

/**
 * Move a card to a player's zone.
 *
 * A card leaving play loses its rotation, damage, modifiers, attachment,
 * control tokens and participation, and any advantages attached to it are
 * discarded. A card leaving the battleground stops participating.
 *
 * @param state - The game.
 * @param instanceId - The card.
 * @param side - The player whose zone receives it.
 * @param zone - The zone.
 * @param toBottom - For the deck, put the card at the bottom rather than the top.
 * @returns The game with the card moved.
 */
export function moveCard(
  state: GameState,
  instanceId: string,
  side: DeckSide,
  zone: PlayerZone,
  toBottom = false,
): GameState {
  const from = locate(state, instanceId);
  const wasInPlay = from?.kind === 'zone' && isInPlayZone(from.zone);
  let next = updatePlayer(detachCard(state, instanceId), side, (player) => ({
    ...player,
    [zone]:
      zone === 'deck' && !toBottom ? [instanceId, ...player[zone]] : [...player[zone], instanceId],
  }));
  if (zone !== 'battleground') {
    next = updateInstance(next, instanceId, withoutParticipation);
  }
  if (wasInPlay && !isInPlayZone(zone)) {
    next = updateInstance(next, instanceId, (instance) => ({
      id: instance.id,
      cardId: instance.cardId,
      owner: instance.owner,
      rotated: false,
      damage: 0,
      lastingModifiers: NO_MODIFIERS,
      turnModifiers: NO_MODIFIERS,
    }));
    next = discardAttachments(next, instanceId);
  }
  return next;
}

/**
 * The characters and troops a player controls.
 *
 * @param state - The game.
 * @param side - The player.
 * @returns Home front then battleground.
 */
export function forcesOf(state: GameState, side: DeckSide): readonly string[] {
  const player = state.players[side];
  return [...player.homeFront, ...player.battleground];
}

/**
 * Every card a player controls in play.
 *
 * @param state - The game.
 * @param side - The player.
 * @returns Forces, then advantages.
 */
export function inPlayIds(state: GameState, side: DeckSide): readonly string[] {
  return [...forcesOf(state, side), ...state.players[side].advantages];
}

/**
 * A player's participants in a challenge.
 *
 * @param state - The game.
 * @param challengeId - The challenge.
 * @param side - The player.
 * @returns The participating cards.
 */
export function participantsOf(
  state: GameState,
  challengeId: string,
  side: DeckSide,
): readonly string[] {
  return state.players[side].battleground.filter(
    (id) => state.cards[id]?.challengeId === challengeId,
  );
}

/**
 * A player's maximum hand size.
 *
 * @param player - The player.
 * @returns The limit, never below zero.
 */
export function maxHandSize(player: PlayerState): number {
  return Math.max(0, BASE_HAND_SIZE + player.handSizeModifier);
}

/**
 * Draw cards from the top of a player's deck.
 *
 * @param state - The game.
 * @param side - The player.
 * @param count - How many to draw. Fewer are drawn if the deck runs out.
 * @returns The game and the cards drawn.
 */
export function drawCards(
  state: GameState,
  side: DeckSide,
  count: number,
): { readonly state: GameState; readonly drawn: readonly string[] } {
  const drawn = state.players[side].deck.slice(0, Math.max(0, count));
  const next = updatePlayer(state, side, (player) => ({
    ...player,
    deck: player.deck.slice(drawn.length),
    hand: [...player.hand, ...drawn],
  }));
  return { state: next, drawn };
}

/**
 * Tokens on the whole Pattern.
 *
 * @param state - The game.
 * @returns Light, shadow and neutral tokens together.
 */
export function patternTotal(state: GameState): number {
  return state.pattern.hero + state.pattern.villain + state.pattern.neutral;
}

/**
 * Change the tokens on a section of the Pattern, bringing on the Last Battle
 * if the Pattern reaches 20.
 *
 * @param state - The game.
 * @param section - The section.
 * @param delta - Tokens to add, negative to remove. The section never goes below zero.
 * @returns The game.
 */
export function changePattern(state: GameState, section: PatternSection, delta: number): GameState {
  const pattern = { ...state.pattern, [section]: Math.max(0, state.pattern[section] + delta) };
  const next = { ...state, pattern };
  const reached =
    patternTotal(next) >= LAST_BATTLE_PATTERN && state.lastBattleStartTurn === undefined;
  return { ...next, lastBattlePending: state.lastBattlePending || reached };
}

/**
 * Convert one of a player's Pattern tokens to a neutral token.
 *
 * @param state - The game.
 * @param side - The player, who must have a token.
 * @returns The game.
 */
export function convertPatternToken(state: GameState, side: DeckSide): GameState {
  return changePattern(changePattern(state, side, -1), 'neutral', 1);
}

/**
 * Whether a list holds the same value twice.
 *
 * @param values - The values.
 * @returns True on any repeat.
 */
export function hasDuplicates(values: readonly string[]): boolean {
  return new Set(values).size !== values.length;
}
