/**
 * Paying for cards.
 *
 * Recruiting a character or troop follows the rulebook's recruiting rules:
 * converted Pattern tokens lower the printed cost first; the cost is then
 * doubled if any symbol shares no allegiance with the card, and doubled again
 * for a Dark Nature card recruited by the Hero player or a Light Nature card
 * recruited by the Villain player. One Power symbols may stand in for any
 * other symbol. Advantages and events are paid with exactly their printed
 * symbols.
 */

import { ABILITY_TRACKS } from '@wot/cards';
import type { AbilityTrack, Allegiance, Card } from '@wot/cards';

import { hasAnyAllegiance, hasTrait } from './cardRules.ts';
import type { DeckSide } from './deck/rules.ts';
import { fail, ok } from './result.ts';
import type { Result } from './result.ts';

/** A number of symbols of each ability. */
export type Cost = Readonly<Record<AbilityTrack, number>>;

/** A symbol offered in payment. */
export interface PaymentSymbol {
  /** Which ability the symbol is. */
  readonly track: AbilityTrack;
  /** The allegiances the symbol has at the moment it is spent. */
  readonly allegiances: readonly Allegiance[];
}

/** Ability names as printed in the rulebook. */
const TRACK_NAMES: Readonly<Record<AbilityTrack, string>> = {
  politics: 'Politics',
  intrigue: 'Intrigue',
  onePower: 'One Power',
  combat: 'Combat',
};

/** Allegiances whose symbols may recruit an Aiel character. */
const AIEL_CHARACTER_SYMBOL_ALLEGIANCES: readonly Allegiance[] = ['Aiel', 'Dragon', 'Dark One'];

/**
 * A card's printed cost.
 *
 * @param card - The card.
 * @returns Symbols of each ability, zero where the card prints none.
 */
export function printedCost(card: Card): Cost {
  return {
    politics: card.abilities.politics.cost ?? 0,
    intrigue: card.abilities.intrigue.cost ?? 0,
    onePower: card.abilities.onePower.cost ?? 0,
    combat: card.abilities.combat.cost ?? 0,
  };
}

/**
 * Describe a cost in words.
 *
 * @param cost - The cost.
 * @returns For example "2 Politics and 1 Combat", or "nothing".
 */
export function describeCost(cost: Cost): string {
  const parts = ABILITY_TRACKS.filter((track) => cost[track] > 0).map(
    (track) => `${cost[track]} ${TRACK_NAMES[track]}`,
  );
  if (parts.length === 0) {
    return 'nothing';
  }
  const last = parts.pop();
  return parts.length === 0 ? `${last}` : `${parts.join(', ')} and ${last}`;
}

/**
 * Count symbols by ability.
 *
 * @param symbols - The symbols.
 * @returns How many of each.
 */
function countByTrack(symbols: readonly PaymentSymbol[]): Cost {
  const counts = { politics: 0, intrigue: 0, onePower: 0, combat: 0 };
  for (const symbol of symbols) {
    counts[symbol.track] += 1;
  }
  return counts;
}

/**
 * Why symbols do not pay a cost exactly, if they do not.
 *
 * @param required - The cost to pay.
 * @param symbols - The symbols offered.
 * @param onePowerSubstitutes - Whether One Power symbols may stand in for other symbols.
 * @returns The reason, or undefined when the symbols pay the cost exactly.
 */
function paymentMismatch(
  required: Cost,
  symbols: readonly PaymentSymbol[],
  onePowerSubstitutes: boolean,
): string | undefined {
  const offered = countByTrack(symbols);
  const mismatch = `The cost is ${describeCost(required)}, but ${describeCost(offered)} was offered.`;
  if (!onePowerSubstitutes) {
    return ABILITY_TRACKS.every((track) => offered[track] === required[track])
      ? undefined
      : mismatch;
  }
  let shortfall = 0;
  for (const track of ABILITY_TRACKS) {
    if (track === 'onePower') {
      continue;
    }
    if (offered[track] > required[track]) {
      return mismatch;
    }
    shortfall += required[track] - offered[track];
  }
  return offered.onePower === required.onePower + shortfall ? undefined : mismatch;
}

/**
 * Check a payment to recruit a character or troop.
 *
 * @param card - The character or troop.
 * @param side - The recruiting player.
 * @param symbols - The symbols offered.
 * @param patternConversions - Pattern tokens converted to lower the cost.
 * @returns The cost that was due, or why the payment does not recruit the card.
 */
export function checkRecruitPayment(
  card: Card,
  side: DeckSide,
  symbols: readonly PaymentSymbol[],
  patternConversions: number,
): Result<Cost> {
  const isTroop = card.type === 'Troop';
  if (!isTroop && card.type !== 'Character') {
    return fail(`${card.name} is not a character or troop.`);
  }
  if (!Number.isInteger(patternConversions) || patternConversions < 0) {
    return fail('Pattern conversions must be a whole number, zero or more.');
  }

  const isAiel = card.allegiances.includes('Aiel');
  const isMercenary = card.allegiances.includes('Mercenary');
  for (const symbol of symbols) {
    if (isAiel && isTroop && !symbol.allegiances.includes('Aiel')) {
      return fail(`Only Aiel symbols can recruit ${card.name}, an Aiel troop.`);
    }
    if (
      isAiel &&
      !isTroop &&
      !hasAnyAllegiance(symbol.allegiances, AIEL_CHARACTER_SYMBOL_ALLEGIANCES)
    ) {
      return fail(
        `Every symbol recruiting ${card.name}, an Aiel character, needs the Aiel, Dragon or Dark One allegiance.`,
      );
    }
    if (isTroop && !isMercenary && !hasAnyAllegiance(symbol.allegiances, card.allegiances)) {
      return fail(`Every symbol recruiting ${card.name}, a troop, must share its allegiance.`);
    }
  }

  const allegiancePenalty =
    !isMercenary &&
    symbols.some((symbol) => !hasAnyAllegiance(symbol.allegiances, card.allegiances));
  const naturePenalty =
    (side === 'hero' && hasTrait(card, 'Dark Nature')) ||
    (side === 'villain' && hasTrait(card, 'Light Nature'));
  const multiplier = (allegiancePenalty ? 2 : 1) * (naturePenalty ? 2 : 1);

  const printed = printedCost(card);
  const required = {
    politics: Math.max(0, printed.politics - patternConversions) * multiplier,
    intrigue: Math.max(0, printed.intrigue - patternConversions) * multiplier,
    onePower: Math.max(0, printed.onePower - patternConversions) * multiplier,
    combat: Math.max(0, printed.combat - patternConversions) * multiplier,
  };
  const mismatch = paymentMismatch(required, symbols, true);
  return mismatch === undefined ? ok(required) : fail(mismatch);
}

/**
 * Check a payment for an advantage or event, which takes exactly its printed
 * symbols.
 *
 * @param card - The advantage or event.
 * @param symbols - The symbols offered.
 * @returns The cost that was due, or why the payment does not match it.
 */
export function checkPrintedPayment(card: Card, symbols: readonly PaymentSymbol[]): Result<Cost> {
  const required = printedCost(card);
  const mismatch = paymentMismatch(required, symbols, false);
  return mismatch === undefined ? ok(required) : fail(mismatch);
}
