/**
 * The rules for placing damage from a damage pool.
 *
 * A player places the damage an opponent generated on their own participating
 * characters (from the character pool) or troops (from the troop pool). No
 * card may take damage beyond mortally wounded until every eligible card is
 * mortally wounded, and all the damage must be placed while any eligible card
 * remains.
 */

import type { Card } from '@wot/cards';

import type { DamageAssignment } from './actions.ts';
import { damageUntilMortallyWounded } from './cardRules.ts';
import type { CardInstance } from './state.ts';

/** A card that may receive damage. */
export interface DamageTarget {
  /** The participating card. */
  readonly instance: CardInstance;
  /** Its card data. */
  readonly card: Card;
}

/**
 * Why an assignment breaks the damage rules, if it does.
 *
 * @param targets - The player's eligible participants.
 * @param assignments - The damage placed on each.
 * @param owed - The damage in the pool.
 * @returns The reason, or undefined when the assignment is legal.
 */
export function damageAssignmentProblem(
  targets: readonly DamageTarget[],
  assignments: readonly DamageAssignment[],
  owed: number,
): string | undefined {
  const byId = new Map(targets.map((target) => [target.instance.id, target]));
  const seen = new Set<string>();
  let total = 0;
  for (const assignment of assignments) {
    if (!byId.has(assignment.instanceId)) {
      return 'Damage can only go on your own participating cards of the right type.';
    }
    if (seen.has(assignment.instanceId)) {
      return 'List each card once.';
    }
    if (!Number.isInteger(assignment.damage) || assignment.damage < 1) {
      return 'Damage on a card must be a whole number, one or more.';
    }
    seen.add(assignment.instanceId);
    total += assignment.damage;
  }

  const due = targets.length === 0 ? 0 : owed;
  if (total !== due) {
    return `Place exactly ${due} damage; ${total} was placed.`;
  }

  function placed(target: DamageTarget): number {
    return (
      assignments.find((assignment) => assignment.instanceId === target.instance.id)?.damage ?? 0
    );
  }
  const overflows = targets.some(
    (target) => placed(target) > damageUntilMortallyWounded(target.instance, target.card),
  );
  const allMortallyWounded = targets.every(
    (target) => placed(target) >= damageUntilMortallyWounded(target.instance, target.card),
  );
  if (overflows && !allMortallyWounded) {
    return 'No card can take damage beyond mortally wounded until every eligible card is mortally wounded.';
  }
  return undefined;
}
