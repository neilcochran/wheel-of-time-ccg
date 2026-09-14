/**
 * The state of a game in progress.
 *
 * Everything here is plain JSON: no functions, classes, maps or sets, so a
 * state can be stored, sent over a network and compared as data. There is one
 * card instance per physical card, and each names the card it is a copy of by
 * card id. Card data is not copied in; the engine is handed the card database
 * alongside the state.
 */

import type { AbilityTrack, Allegiance, Card } from '@wot/cards';

import type { DeckSide } from './deck/rules.ts';
import type { RandomState } from './random.ts';

/** The state format version this code reads and writes. */
export const GAME_STATE_VERSION = 1;

/** Every card the engine may meet, by card id. */
export type CardLookup = ReadonlyMap<string, Card>;

/** A section of the Pattern: a player's own section, or the neutral one. */
export type PatternSection = DeckSide | 'neutral';

/** Tokens on each section of the Pattern. */
export interface Pattern {
  /** Light tokens, on the Hero player's section. */
  readonly hero: number;
  /** Shadow tokens, on the Villain player's section. */
  readonly villain: number;
  /** Neutral tokens. */
  readonly neutral: number;
}

/** An amount added to each ability. */
export type AbilityModifiers = Readonly<Record<AbilityTrack, number>>;

/** What an advantage in play is attached to. */
export type AttachmentTarget =
  | {
      /** Discriminator. */
      readonly kind: 'card';
      /** The character or troop the advantage is on. */
      readonly instanceId: string;
    }
  | {
      /** Discriminator. */
      readonly kind: 'player';
      /** The player the advantage is on. */
      readonly side: DeckSide;
    }
  | {
      /** Discriminator. The advantage affects the whole game. */
      readonly kind: 'world';
    };

/** One physical card and what is currently marked on it. */
export interface CardInstance {
  /** Opaque identifier, unique within the game. */
  readonly id: string;
  /** The card this is a copy of. */
  readonly cardId: string;
  /** The player whose deck the card came from. */
  readonly owner: DeckSide;
  /** Whether the card is rotated, having acted this turn. */
  readonly rotated: boolean;
  /** Damage tokens on the card. */
  readonly damage: number;
  /** Ability changes that last until the card leaves play. */
  readonly lastingModifiers: AbilityModifiers;
  /** Ability changes that expire at the end of the turn. */
  readonly turnModifiers: AbilityModifiers;
  /** What the card is attached to, for an advantage in play. */
  readonly attachedTo?: AttachmentTarget;
  /** Control tokens each player has on a contested advantage. */
  readonly controlTokens?: Readonly<Record<DeckSide, number>>;
  /** The challenge a character or troop is participating in. */
  readonly challengeId?: string;
}

/** Where a resource symbol came from, which decides its allegiances. */
export type SymbolSource =
  | {
      /**
       * Discriminator. Rolled by a card, so the symbol has that card's
       * allegiances at the moment it is spent.
       */
      readonly kind: 'card';
      /** The card that generated the symbol. */
      readonly instanceId: string;
    }
  | {
      /** Discriminator. Added by a player applying card text. */
      readonly kind: 'manual';
      /** The allegiances the symbol has. */
      readonly allegiances: readonly Allegiance[];
    };

/** An ability symbol waiting in a resource pool. */
export interface ResourceSymbol {
  /** Opaque identifier, unique within the game. */
  readonly id: string;
  /** Which ability the symbol is. */
  readonly track: AbilityTrack;
  /** Where the symbol came from. */
  readonly source: SymbolSource;
}

/**
 * One player's cards and resources.
 *
 * Each zone lists instance ids. Piles are ordered oldest first, except the
 * deck, which lists its top card first. Cards in play sit in the zones of the
 * player who controls them; everywhere else, in their owner's.
 */
export interface PlayerState {
  /** The draw deck, top card first. */
  readonly deck: readonly string[];
  /** Cards in hand. */
  readonly hand: readonly string[];
  /** The discard pile. */
  readonly discard: readonly string[];
  /** The killed pile. */
  readonly killed: readonly string[];
  /** Cards removed from play, in neither pile. */
  readonly removed: readonly string[];
  /** Characters and troops at the home front. */
  readonly homeFront: readonly string[];
  /** Characters and troops in the battleground. */
  readonly battleground: readonly string[];
  /** Advantages in play. */
  readonly advantages: readonly string[];
  /** The Dragon Reborn a Mat or Perrin deck keeps face down, until revealed. */
  readonly faceDownDragonReborn?: string;
  /** The Starting Hero or Villain, or whatever has since replaced it. */
  readonly startingCharacter: string;
  /** Ability symbols available to spend this round. */
  readonly pool: readonly ResourceSymbol[];
  /** Change to the maximum hand size of 8 applied from card text. */
  readonly handSizeModifier: number;
}

/** How a challenge was initiated. */
export type ChallengeKind = 'pattern' | 'card' | 'contested' | 'lastBattle';

/** The result of a resolved challenge. */
export interface ChallengeOutcome {
  /** Whether support exceeded opposition. */
  readonly succeeded: boolean;
  /** Support minus opposition. Negative when opposition was greater. */
  readonly margin: number;
}

/** A challenge in play this turn. */
export interface Challenge {
  /** Opaque identifier, unique within the game. */
  readonly id: string;
  /** How the challenge was initiated. */
  readonly kind: ChallengeKind;
  /** The player supporting the challenge. The other opposes it. */
  readonly initiator: DeckSide;
  /** The challenge card, for a card-based challenge that has not left the challenge. */
  readonly cardInstanceId?: string;
  /** The advantage being contested, for a contested advantage challenge. */
  readonly advantageInstanceId?: string;
  /** Support generated so far. */
  readonly support: number;
  /** Opposition generated so far. */
  readonly opposition: number;
  /** The result, once resolved. */
  readonly outcome?: ChallengeOutcome;
}

/** A player's choice in the Declare Challenges step. */
export type ChallengeDeclaration =
  | {
      /** Discriminator. No challenge this turn. */
      readonly kind: 'none';
    }
  | {
      /** Discriminator. Play a challenge card. */
      readonly kind: 'card';
      /** The challenge card, from the player's hand. */
      readonly instanceId: string;
    }
  | {
      /** Discriminator. Contest control of an advantage. */
      readonly kind: 'contested';
      /** The contested advantage in play. */
      readonly advantageInstanceId: string;
    };

/** One card committed to a challenge. */
export interface Commitment {
  /** The character or troop in the battleground. */
  readonly instanceId: string;
  /** The challenge it participates in. */
  readonly challengeId: string;
}

/** The two dice-rolling steps of a challenge's resolution. */
export type ResolutionStage = 'openingMoves' | 'comingToGrips';

/** The points at which both players get a chance to play events. */
export type EventWindowPoint =
  'readyRound' | 'challengeRound' | 'actionRound' | 'openingMoves' | 'comingToGrips' | 'drawRound';

/** The decision the game is waiting on. */
export type Step =
  | {
      /** Discriminator. At the start of the Last Battle, reveal the face-down Dragon Reborn or not. */
      readonly kind: 'revealDragonReborn';
      /** The player holding the face-down card. */
      readonly side: DeckSide;
    }
  | {
      /** Discriminator. Each player plays a challenge face down, or declines. */
      readonly kind: 'declareChallenges';
      /** Declarations so far. Hidden from the other player until both are in. */
      readonly declarations: Partial<Record<DeckSide, ChallengeDeclaration>>;
    }
  | {
      /** Discriminator. A player moves characters and troops to the battleground. */
      readonly kind: 'placeForces';
      /** The player placing forces. */
      readonly side: DeckSide;
    }
  | {
      /** Discriminator. Each player commits battleground cards to challenges. */
      readonly kind: 'determineParticipation';
      /** Commitments so far. Hidden from the other player until both are in. */
      readonly commitments: Partial<Record<DeckSide, readonly Commitment[]>>;
    }
  | {
      /** Discriminator. A player rotates home front characters to roll for symbols. */
      readonly kind: 'generateResources';
      /** The player generating. */
      readonly side: DeckSide;
    }
  | {
      /** Discriminator. A player takes actions. */
      readonly kind: 'takeActions';
      /** The player acting. */
      readonly side: DeckSide;
    }
  | {
      /** Discriminator. Each player announces which participants rotate to roll. */
      readonly kind: 'declareRollers';
      /** The challenge being resolved. */
      readonly challengeId: string;
      /** Characters roll in Opening Moves, troops in Coming to Grips. */
      readonly stage: ResolutionStage;
      /** Announcements so far. */
      readonly rollers: Partial<Record<DeckSide, readonly string[]>>;
    }
  | {
      /** Discriminator. A player places the damage the other generated on their own participants. */
      readonly kind: 'assignDamage';
      /** The challenge being resolved. */
      readonly challengeId: string;
      /** The stage that generated the damage. */
      readonly stage: ResolutionStage;
      /** The player assigning. */
      readonly side: DeckSide;
      /** Damage each player must still place on their own cards. */
      readonly owed: Readonly<Record<DeckSide, number>>;
    }
  | {
      /** Discriminator. Players take turns to play events or pass. */
      readonly kind: 'eventWindow';
      /** Where in the turn the window is. */
      readonly point: EventWindowPoint;
      /** The challenge being resolved, for windows inside a resolution. */
      readonly challengeId?: string;
      /** The player who may play an event or pass. */
      readonly priority: DeckSide;
      /** Consecutive passes. The window closes at two. */
      readonly passes: number;
    }
  | {
      /** Discriminator. Each player discards down to their maximum hand size. */
      readonly kind: 'discardDown';
      /** Discards so far. Hidden from the other player until both are in. */
      readonly discards: Partial<Record<DeckSide, readonly string[]>>;
    }
  | {
      /** Discriminator. The game has ended. */
      readonly kind: 'gameOver';
      /** The winner, absent when both players lost. */
      readonly winner?: DeckSide;
      /** The players who lost. */
      readonly losers: readonly DeckSide[];
    };

/** What the most recent Last Battle challenge decided. */
export interface LastBattleOutcome {
  /** The player who won by 5 or more, if either did. */
  readonly winner?: DeckSide;
  /** Players who generated none of what they needed and did not win. */
  readonly failedToGenerate: readonly DeckSide[];
}

/** A line in the game log. */
export interface LogEntry {
  /** The turn it happened in. */
  readonly turn: number;
  /** What happened, as a sentence for display. */
  readonly text: string;
  /** The only player who may see it, when it reveals hidden information. */
  readonly visibleTo?: DeckSide;
}

/** A game in progress. */
export interface GameState {
  /** The state format version. */
  readonly version: number;
  /** The random number generator's state. Never shown to players. */
  readonly random: RandomState;
  /** Counter for generating challenge and symbol ids. */
  readonly nextId: number;
  /** The current turn, from 1. */
  readonly turn: number;
  /** The dominant player for the turn. */
  readonly dominant: DeckSide;
  /** Tokens on the Pattern. */
  readonly pattern: Pattern;
  /** True once the Pattern has reached 20 tokens and before the Last Battle starts. */
  readonly lastBattlePending: boolean;
  /** The turn the Last Battle started, once it has. */
  readonly lastBattleStartTurn?: number;
  /** What this turn's Last Battle challenge decided, until the Victory Check reads it. */
  readonly lastBattleOutcome?: LastBattleOutcome;
  /** Every card instance, by instance id. */
  readonly cards: Readonly<Record<string, CardInstance>>;
  /** Each player's zones and resources. */
  readonly players: Readonly<Record<DeckSide, PlayerState>>;
  /** This turn's challenges, in resolution order. */
  readonly challenges: readonly Challenge[];
  /** Card ids of Unique cards that have entered play, which no other copy of may. */
  readonly enteredUnique: readonly string[];
  /** The decision the game is waiting on. */
  readonly step: Step;
  /** Everything that has happened, oldest first. */
  readonly log: readonly LogEntry[];
}
