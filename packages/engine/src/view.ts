/**
 * What each player may see of a game.
 *
 * A view holds only what its player is entitled to know. The opponent's hand
 * and both decks are counts, and the cards in them are left out of the card
 * list. The opponent's face-down choices stay hidden until both players have
 * chosen. Log lines meant for one player go to that player only, and the
 * random number generator's state is never included.
 */

import type { DeckSide } from './deck/rules.ts';
import type {
  CardInstance,
  Challenge,
  ChallengeDeclaration,
  Commitment,
  GameState,
  LogEntry,
  Pattern,
  ResourceSymbol,
  Step,
} from './state.ts';
import { SIDES, firstPending, maxHandSize } from './stateOps.ts';

/** What a player may see of one player's cards. */
export interface PlayerView {
  /** Cards in the deck. */
  readonly deckSize: number;
  /** Cards in hand. */
  readonly handSize: number;
  /** The cards in hand, for the viewer's own hand only. */
  readonly hand?: readonly string[];
  /** The discard pile. */
  readonly discard: readonly string[];
  /** The killed pile. */
  readonly killed: readonly string[];
  /** Cards removed from play. */
  readonly removed: readonly string[];
  /** Characters and troops at the home front. */
  readonly homeFront: readonly string[];
  /** Characters and troops in the battleground. */
  readonly battleground: readonly string[];
  /** Advantages in play. */
  readonly advantages: readonly string[];
  /** Whether the player holds a face-down Dragon Reborn. */
  readonly hasFaceDownDragonReborn: boolean;
  /** The face-down Dragon Reborn, for the viewer's own only. */
  readonly faceDownDragonReborn?: string;
  /** The Starting Hero or Villain, or whatever has replaced it. */
  readonly startingCharacter: string;
  /** Ability symbols available to spend. */
  readonly pool: readonly ResourceSymbol[];
  /** The player's maximum hand size. */
  readonly maxHandSize: number;
}

/**
 * The step as the viewer may see it. Steps where players choose in secret
 * show who has chosen and the viewer's own choice only.
 */
export type StepView =
  | Exclude<Step, { readonly kind: 'declareChallenges' | 'determineParticipation' | 'discardDown' }>
  | {
      /** Discriminator. */
      readonly kind: 'declareChallenges';
      /** Players who have declared. */
      readonly submitted: readonly DeckSide[];
      /** The viewer's declaration, once made. */
      readonly own?: ChallengeDeclaration;
    }
  | {
      /** Discriminator. */
      readonly kind: 'determineParticipation';
      /** Players who have committed. */
      readonly submitted: readonly DeckSide[];
      /** The viewer's commitments, once made. */
      readonly own?: readonly Commitment[];
    }
  | {
      /** Discriminator. */
      readonly kind: 'discardDown';
      /** Players who have chosen their discards. */
      readonly submitted: readonly DeckSide[];
      /** The viewer's discards, once chosen. */
      readonly own?: readonly string[];
    };

/** A game as one player may see it. */
export interface GameView {
  /** The player this view is for. */
  readonly viewer: DeckSide;
  /** The current turn. */
  readonly turn: number;
  /** The dominant player for the turn. */
  readonly dominant: DeckSide;
  /** Tokens on the Pattern. */
  readonly pattern: Pattern;
  /** True once the Pattern has reached 20 tokens and before the Last Battle starts. */
  readonly lastBattlePending: boolean;
  /** The turn the Last Battle started, once it has. */
  readonly lastBattleStartTurn?: number;
  /** The card instances the viewer may see, by instance id. */
  readonly cards: Readonly<Record<string, CardInstance>>;
  /** Each player's cards as the viewer may see them. */
  readonly players: Readonly<Record<DeckSide, PlayerView>>;
  /** This turn's challenges, in resolution order. */
  readonly challenges: readonly Challenge[];
  /** The decision the game is waiting on. */
  readonly step: StepView;
  /** The players the game is waiting on. */
  readonly waitingOn: readonly DeckSide[];
  /** The log lines the viewer may see. */
  readonly log: readonly LogEntry[];
}

/**
 * The first player still to choose, as a list.
 *
 * @param state - The game.
 * @param submissions - Choices so far.
 * @returns The player, or nobody.
 */
function pending(
  state: GameState,
  submissions: Partial<Record<DeckSide, unknown>>,
): readonly DeckSide[] {
  const side = firstPending(state, submissions);
  return side === undefined ? [] : [side];
}

/**
 * The players the game is waiting on, which for a hot-seat game is whoever
 * should hold the device.
 *
 * @param state - The game.
 * @returns One player, or nobody once the game is over.
 */
export function waitingOn(state: GameState): readonly DeckSide[] {
  const step = state.step;
  switch (step.kind) {
    case 'revealDragonReborn':
    case 'placeForces':
    case 'generateResources':
    case 'takeActions':
    case 'assignDamage':
      return [step.side];
    case 'eventWindow':
      return [step.priority];
    case 'declareChallenges':
      return pending(state, step.declarations);
    case 'determineParticipation':
      return pending(state, step.commitments);
    case 'declareRollers':
      return pending(state, step.rollers);
    case 'discardDown':
      return pending(state, step.discards);
    case 'gameOver':
      return [];
  }
}

/**
 * The sides that have made a secret choice.
 *
 * @param submissions - Choices so far.
 * @returns The sides, Hero first.
 */
function submittedSides(submissions: Partial<Record<DeckSide, unknown>>): readonly DeckSide[] {
  return SIDES.filter((side) => submissions[side] !== undefined);
}

/**
 * The step as a player may see it.
 *
 * @param step - The step.
 * @param viewer - The player.
 * @returns The step with the other player's secret choice left out.
 */
function viewStep(step: Step, viewer: DeckSide): StepView {
  switch (step.kind) {
    case 'declareChallenges': {
      const own = step.declarations[viewer];
      const submitted = submittedSides(step.declarations);
      return own === undefined
        ? { kind: step.kind, submitted }
        : { kind: step.kind, submitted, own };
    }
    case 'determineParticipation': {
      const own = step.commitments[viewer];
      const submitted = submittedSides(step.commitments);
      return own === undefined
        ? { kind: step.kind, submitted }
        : { kind: step.kind, submitted, own };
    }
    case 'discardDown': {
      const own = step.discards[viewer];
      const submitted = submittedSides(step.discards);
      return own === undefined
        ? { kind: step.kind, submitted }
        : { kind: step.kind, submitted, own };
    }
    default:
      return step;
  }
}

/**
 * Build the view of a game for one player.
 *
 * @param state - The game.
 * @param viewer - The player.
 * @returns Everything the player may see.
 */
export function viewFor(state: GameState, viewer: DeckSide): GameView {
  const visible = new Set<string>();

  function viewPlayer(side: DeckSide): PlayerView {
    const player = state.players[side];
    const own = side === viewer;
    const shown = [
      ...player.discard,
      ...player.killed,
      ...player.removed,
      ...player.homeFront,
      ...player.battleground,
      ...player.advantages,
      ...(own ? player.hand : []),
      ...(own && player.faceDownDragonReborn !== undefined ? [player.faceDownDragonReborn] : []),
    ];
    for (const id of shown) {
      visible.add(id);
    }
    return {
      deckSize: player.deck.length,
      handSize: player.hand.length,
      ...(own ? { hand: player.hand } : {}),
      discard: player.discard,
      killed: player.killed,
      removed: player.removed,
      homeFront: player.homeFront,
      battleground: player.battleground,
      advantages: player.advantages,
      hasFaceDownDragonReborn: player.faceDownDragonReborn !== undefined,
      ...(own && player.faceDownDragonReborn !== undefined
        ? { faceDownDragonReborn: player.faceDownDragonReborn }
        : {}),
      startingCharacter: player.startingCharacter,
      pool: player.pool,
      maxHandSize: maxHandSize(player),
    };
  }

  const players = { hero: viewPlayer('hero'), villain: viewPlayer('villain') };
  for (const challenge of state.challenges) {
    if (challenge.cardInstanceId !== undefined) {
      visible.add(challenge.cardInstanceId);
    }
  }
  return {
    viewer,
    turn: state.turn,
    dominant: state.dominant,
    pattern: state.pattern,
    lastBattlePending: state.lastBattlePending,
    ...(state.lastBattleStartTurn === undefined
      ? {}
      : { lastBattleStartTurn: state.lastBattleStartTurn }),
    cards: Object.fromEntries(Object.entries(state.cards).filter(([id]) => visible.has(id))),
    players,
    challenges: state.challenges,
    step: viewStep(state.step, viewer),
    waitingOn: waitingOn(state),
    log: state.log.filter((entry) => entry.visibleTo === undefined || entry.visibleTo === viewer),
  };
}
