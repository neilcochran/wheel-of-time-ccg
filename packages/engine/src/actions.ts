/**
 * Everything a player can do, as serialisable actions.
 *
 * Each action names the side taking it. The engine checks every action against
 * the current state and refuses anything the rules do not allow at that
 * moment, so it never trusts a client to have offered only legal moves.
 *
 * Card text is not yet part of the engine. Players apply it themselves with
 * manual changes, which are logged for both players to see.
 */

import type { AbilityTrack, Allegiance } from '@wot/cards';

import type { DeckSide } from './deck/rules.ts';
import type {
  AttachmentTarget,
  ChallengeDeclaration,
  Commitment,
  PatternSection,
} from './state.ts';

/** Damage placed on one card. */
export interface DamageAssignment {
  /** The participating card. */
  readonly instanceId: string;
  /** Damage tokens to place on it. */
  readonly damage: number;
}

/** Where a manual change can send a card. */
export type ManualDestination =
  | 'hand'
  | 'deckTop'
  | 'deckBottom'
  | 'discard'
  | 'killed'
  | 'removed'
  | 'homeFront'
  | 'battleground';

/** A change a player makes by hand to apply card text. */
export type ManualChange =
  | {
      /** Discriminator. Add or remove damage tokens. */
      readonly kind: 'damage';
      /** The character or troop in play. */
      readonly instanceId: string;
      /** Tokens to add, or remove when negative. */
      readonly delta: number;
    }
  | {
      /** Discriminator. Move a Pattern token between sections, or add or remove one. */
      readonly kind: 'pattern';
      /** Where the token comes from, or `supply` to add a new one. */
      readonly from: PatternSection | 'supply';
      /** Where the token goes, or `supply` to remove it. */
      readonly to: PatternSection | 'supply';
    }
  | {
      /** Discriminator. Draw cards. */
      readonly kind: 'draw';
      /** How many. */
      readonly count: number;
    }
  | {
      /** Discriminator. Move a card to a zone. */
      readonly kind: 'moveCard';
      /** The card. */
      readonly instanceId: string;
      /** Where it goes. Piles, hand and deck are the owner's; play is its current controller's, or its owner's. */
      readonly to: ManualDestination;
    }
  | {
      /** Discriminator. Put a card into play as an advantage. */
      readonly kind: 'attachAdvantage';
      /** The card, anywhere outside play. */
      readonly instanceId: string;
      /** What it attaches to. */
      readonly target: AttachmentTarget;
    }
  | {
      /** Discriminator. Give control of a card in play to a player. */
      readonly kind: 'control';
      /** The card in play. */
      readonly instanceId: string;
      /** The player taking control. */
      readonly controller: DeckSide;
    }
  | {
      /** Discriminator. Rotate or ready a card in play. */
      readonly kind: 'rotate';
      /** The card in play. */
      readonly instanceId: string;
      /** True to rotate, false to ready. */
      readonly rotated: boolean;
    }
  | {
      /** Discriminator. Raise or lower an ability. */
      readonly kind: 'ability';
      /** The character or troop in play. */
      readonly instanceId: string;
      /** Which ability. */
      readonly track: AbilityTrack;
      /** Amount to add, negative to lower. */
      readonly delta: number;
      /** True if the change lasts beyond the end of the turn. */
      readonly lasting: boolean;
    }
  | {
      /** Discriminator. Add to or take from a challenge's support and opposition. */
      readonly kind: 'challengeTotals';
      /** The unresolved challenge. */
      readonly challengeId: string;
      /** Support to add, negative to take away. */
      readonly support: number;
      /** Opposition to add, negative to take away. */
      readonly opposition: number;
    }
  | {
      /** Discriminator. Add ability symbols to the acting player's pool. */
      readonly kind: 'addSymbols';
      /** Which ability. */
      readonly track: AbilityTrack;
      /** How many. */
      readonly count: number;
      /** The allegiances the symbols have. */
      readonly allegiances: readonly Allegiance[];
    }
  | {
      /** Discriminator. Spend or lose symbols from the acting player's pool. */
      readonly kind: 'removeSymbols';
      /** The symbols. */
      readonly symbolIds: readonly string[];
    }
  | {
      /** Discriminator. Shuffle the acting player's deck. */
      readonly kind: 'shuffleDeck';
    }
  | {
      /** Discriminator. Take a card from the acting player's deck into hand, then shuffle. */
      readonly kind: 'searchDeck';
      /** The card to find. */
      readonly cardId: string;
    }
  | {
      /** Discriminator. Change the acting player's maximum hand size. */
      readonly kind: 'handSize';
      /** Amount to add, negative to lower. */
      readonly delta: number;
    }
  | {
      /** Discriminator. Add or remove control tokens on a contested advantage. */
      readonly kind: 'controlTokens';
      /** The contested advantage in play. */
      readonly instanceId: string;
      /** Whose tokens. */
      readonly side: DeckSide;
      /** Tokens to add, negative to remove. */
      readonly delta: number;
    }
  | {
      /** Discriminator. Replace a character in play with a card from hand. */
      readonly kind: 'replaceCharacter';
      /** The character in play, owned and controlled by the acting player. */
      readonly instanceId: string;
      /** The replacement, from the acting player's hand. */
      readonly replacementId: string;
    };

/** An action a player takes. */
export type GameAction =
  | {
      /** Discriminator. */
      readonly type: 'revealDragonReborn';
      /** The acting player. */
      readonly side: DeckSide;
      /** True to reveal the face-down card. */
      readonly reveal: boolean;
    }
  | {
      /** Discriminator. */
      readonly type: 'declareChallenge';
      /** The acting player. */
      readonly side: DeckSide;
      /** The challenge, or none. */
      readonly declaration: ChallengeDeclaration;
    }
  | {
      /** Discriminator. */
      readonly type: 'placeForces';
      /** The acting player. */
      readonly side: DeckSide;
      /** Home front characters and troops to move to the battleground. */
      readonly instanceIds: readonly string[];
    }
  | {
      /** Discriminator. */
      readonly type: 'commitParticipation';
      /** The acting player. */
      readonly side: DeckSide;
      /** Where each battleground card goes. Cards left out stand down. */
      readonly commitments: readonly Commitment[];
    }
  | {
      /** Discriminator. */
      readonly type: 'generateSymbols';
      /** The acting player. */
      readonly side: DeckSide;
      /** The ready home front character to rotate and roll. */
      readonly instanceId: string;
    }
  | {
      /** Discriminator. Finish generating symbols. */
      readonly type: 'endGenerateResources';
      /** The acting player. */
      readonly side: DeckSide;
    }
  | {
      /** Discriminator. */
      readonly type: 'recruit';
      /** The acting player. */
      readonly side: DeckSide;
      /** The character or troop in hand. */
      readonly instanceId: string;
      /** Symbols from the pool to pay with. */
      readonly symbolIds: readonly string[];
      /** Pattern tokens to convert to lower the cost. */
      readonly patternConversions: number;
    }
  | {
      /** Discriminator. */
      readonly type: 'playAdvantage';
      /** The acting player. */
      readonly side: DeckSide;
      /** The advantage in hand. */
      readonly instanceId: string;
      /** What the advantage attaches to. */
      readonly target: AttachmentTarget;
      /** Symbols from the pool to pay with. */
      readonly symbolIds: readonly string[];
    }
  | {
      /** Discriminator. */
      readonly type: 'playLimitedEvent';
      /** The acting player. */
      readonly side: DeckSide;
      /** The limited event in hand. */
      readonly instanceId: string;
      /** Symbols from the pool to pay with. */
      readonly symbolIds: readonly string[];
    }
  | {
      /** Discriminator. */
      readonly type: 'heal';
      /** The acting player. */
      readonly side: DeckSide;
      /** The ready, damaged home front card. */
      readonly instanceId: string;
    }
  | {
      /** Discriminator. */
      readonly type: 'reinforce';
      /** The acting player. */
      readonly side: DeckSide;
      /** The standing-down battleground card with Reinforcement. */
      readonly instanceId: string;
      /** The challenge to join. */
      readonly challengeId: string;
    }
  | {
      /** Discriminator. Finish taking actions. */
      readonly type: 'endActions';
      /** The acting player. */
      readonly side: DeckSide;
    }
  | {
      /** Discriminator. */
      readonly type: 'declareRollers';
      /** The acting player. */
      readonly side: DeckSide;
      /** Ready participants to rotate and roll. */
      readonly instanceIds: readonly string[];
    }
  | {
      /** Discriminator. */
      readonly type: 'assignDamage';
      /** The acting player. */
      readonly side: DeckSide;
      /** Damage on each of the player's own participants. */
      readonly assignments: readonly DamageAssignment[];
    }
  | {
      /** Discriminator. */
      readonly type: 'playEvent';
      /** The acting player. */
      readonly side: DeckSide;
      /** The event in hand. */
      readonly instanceId: string;
      /** Symbols from the pool to pay with. */
      readonly symbolIds: readonly string[];
    }
  | {
      /** Discriminator. Convert a Pattern token to heal a Ta'veren, as an event. */
      readonly type: 'taverenHeal';
      /** The acting player, who must be the Hero player. */
      readonly side: DeckSide;
      /** The damaged Ta'veren in play. */
      readonly instanceId: string;
    }
  | {
      /** Discriminator. Decline to play an event in an event window. */
      readonly type: 'pass';
      /** The acting player. */
      readonly side: DeckSide;
    }
  | {
      /** Discriminator. */
      readonly type: 'discardDown';
      /** The acting player. */
      readonly side: DeckSide;
      /** Cards from hand to discard. */
      readonly instanceIds: readonly string[];
    }
  | {
      /** Discriminator. */
      readonly type: 'manual';
      /** The acting player. */
      readonly side: DeckSide;
      /** The change. */
      readonly change: ManualChange;
    };
