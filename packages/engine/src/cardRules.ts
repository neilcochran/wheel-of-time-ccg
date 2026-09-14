/**
 * Rules questions about single cards and groups of cards: current abilities,
 * mortal wounds, who may control a card, and who may participate together.
 */

import { ABILITY_TRACKS } from '@wot/cards';
import type { AbilityTrack, Allegiance, Card, Trait } from '@wot/cards';

import { forbiddenSideOf } from './deck/rules.ts';
import type { DeckSide } from './deck/rules.ts';
import type { AbilityModifiers, CardInstance } from './state.ts';

/** Modifiers that change nothing. */
export const NO_MODIFIERS: AbilityModifiers = { politics: 0, intrigue: 0, onePower: 0, combat: 0 };

/** The abilities that may be rolled in a Last Battle challenge. */
export const LAST_BATTLE_TRACKS: readonly AbilityTrack[] = ['intrigue', 'onePower', 'combat'];

/**
 * Whether a card has a trait.
 *
 * @param card - The card.
 * @param trait - The trait.
 * @returns True when the card prints the trait.
 */
export function hasTrait(card: Card, trait: Trait): boolean {
  return card.traits.includes(trait);
}

/**
 * Whether two cards share an allegiance.
 *
 * @param a - One card.
 * @param b - The other.
 * @returns True when some allegiance is on both.
 */
export function sharesAllegiance(a: Card, b: Card): boolean {
  return a.allegiances.some((allegiance) => b.allegiances.includes(allegiance));
}

/**
 * Whether a list of allegiances includes one of another list.
 *
 * @param allegiances - The allegiances held.
 * @param wanted - The allegiances looked for.
 * @returns True on any overlap.
 */
export function hasAnyAllegiance(
  allegiances: readonly Allegiance[],
  wanted: readonly Allegiance[],
): boolean {
  return allegiances.some((allegiance) => wanted.includes(allegiance));
}

/**
 * An ability before damage: printed, plus every modifier on the card.
 *
 * @param instance - The card instance.
 * @param card - Its card data.
 * @param track - Which ability.
 * @returns The rating, which modifiers may take below zero.
 */
function modifiedAbility(instance: CardInstance, card: Card, track: AbilityTrack): number {
  return (
    (card.abilities[track].ability ?? 0) +
    instance.lastingModifiers[track] +
    instance.turnModifiers[track]
  );
}

/**
 * A card's current ability: printed, modified, then lowered by one per damage
 * token, never below zero.
 *
 * @param instance - The card instance.
 * @param card - Its card data.
 * @param track - Which ability.
 * @returns The current rating, which is also how many dice it rolls.
 */
export function currentAbility(instance: CardInstance, card: Card, track: AbilityTrack): number {
  return Math.max(0, modifiedAbility(instance, card, track) - instance.damage);
}

/**
 * Whether a card is mortally wounded: it has damage and no ability above zero.
 *
 * @param instance - The card instance.
 * @param card - Its card data.
 * @returns True when mortally wounded.
 */
export function isMortallyWounded(instance: CardInstance, card: Card): boolean {
  return (
    instance.damage > 0 &&
    ABILITY_TRACKS.every((track) => currentAbility(instance, card, track) === 0)
  );
}

/**
 * How much more damage would leave a card mortally wounded.
 *
 * @param instance - The card instance.
 * @param card - Its card data.
 * @returns Zero for a card already mortally wounded.
 */
export function damageUntilMortallyWounded(instance: CardInstance, card: Card): number {
  const highest = Math.max(
    ...ABILITY_TRACKS.map((track) => modifiedAbility(instance, card, track)),
  );
  return Math.max(0, highest - instance.damage, 1 - instance.damage);
}

/**
 * Why a player may not control a card, if they may not.
 *
 * Dark One characters and troops cannot be controlled by the Hero player,
 * Dragon ones by the Villain player, and the Villain player may not control a
 * Ta'veren.
 *
 * @param side - The player.
 * @param card - The card.
 * @returns The reason, or undefined when the player may control it.
 */
export function controlProblem(side: DeckSide, card: Card): string | undefined {
  if (forbiddenSideOf(card) === side) {
    const allegiance = side === 'hero' ? 'Dark One' : 'Dragon';
    const player = side === 'hero' ? 'Hero' : 'Villain';
    return `${card.name} has the ${allegiance} allegiance, so the ${player} player cannot control it.`;
  }
  if (side === 'villain' && hasTrait(card, "Ta'veren")) {
    return `${card.name} is Ta'veren, so the Villain player cannot control it.`;
  }
  return undefined;
}

/**
 * Whether a card has only the printed Mercenary allegiance.
 *
 * @param card - The card.
 * @returns True when Mercenary is its one allegiance.
 */
function isMercenaryOnly(card: Card): boolean {
  return card.allegiances.length === 1 && card.allegiances[0] === 'Mercenary';
}

/**
 * Why a group of one player's cards may not participate in the same challenge
 * together, if they may not.
 *
 * A Monster may only participate alongside Dark One or Monster cards. A
 * Children of the Light card may only participate alongside cards sharing an
 * allegiance with it, or cards whose only allegiance is Mercenary.
 *
 * @param group - The player's participants in one challenge.
 * @returns The reason, or undefined when the group is allowed.
 */
export function allyGroupProblem(group: readonly Card[]): string | undefined {
  for (const [index, card] of group.entries()) {
    const others = group.filter((_, otherIndex) => otherIndex !== index);
    if (hasTrait(card, 'Monster')) {
      const other = others.find(
        (candidate) =>
          !candidate.allegiances.includes('Dark One') && !hasTrait(candidate, 'Monster'),
      );
      if (other !== undefined) {
        return `${card.name} is a Monster, so it cannot participate alongside ${other.name}.`;
      }
    }
    if (card.allegiances.includes('Children of the Light')) {
      const other = others.find(
        (candidate) => !sharesAllegiance(candidate, card) && !isMercenaryOnly(candidate),
      );
      if (other !== undefined) {
        return `${card.name} is Children of the Light, so it cannot participate alongside ${other.name}.`;
      }
    }
  }
  return undefined;
}
