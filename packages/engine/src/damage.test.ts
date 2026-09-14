import { describe, expect, it } from 'vitest';

import { NO_MODIFIERS } from './cardRules.ts';
import { damageAssignmentProblem } from './damage.ts';
import type { DamageTarget } from './damage.ts';
import { makeCard } from './testCards.ts';

/**
 * A participating character whose highest ability is the given rating.
 *
 * @param id - The instance and card id.
 * @param rating - Its Combat ability.
 * @param damage - Damage already on it.
 * @returns The target.
 */
function target(id: string, rating: number, damage = 0): DamageTarget {
  return {
    instance: {
      id,
      cardId: id,
      owner: 'hero',
      rotated: false,
      damage,
      lastingModifiers: NO_MODIFIERS,
      turnModifiers: NO_MODIFIERS,
    },
    card: makeCard({
      id,
      type: 'Character',
      abilities: { politics: {}, intrigue: {}, onePower: {}, combat: { ability: rating } },
    }),
  };
}

const TARGETS = [target('a', 2), target('b', 3)];

describe('damageAssignmentProblem', () => {
  it('allows spreading damage short of mortal wounds', () => {
    expect(
      damageAssignmentProblem(
        TARGETS,
        [
          { instanceId: 'a', damage: 2 },
          { instanceId: 'b', damage: 2 },
        ],
        4,
      ),
    ).toBeUndefined();
  });

  it('refuses damage beyond mortally wounded while another card is not', () => {
    expect(
      damageAssignmentProblem(
        TARGETS,
        [
          { instanceId: 'a', damage: 3 },
          { instanceId: 'b', damage: 1 },
        ],
        4,
      ),
    ).toMatch(/beyond mortally wounded/);
  });

  it('allows overflow once every card is mortally wounded', () => {
    expect(
      damageAssignmentProblem(
        TARGETS,
        [
          { instanceId: 'a', damage: 4 },
          { instanceId: 'b', damage: 3 },
        ],
        7,
      ),
    ).toBeUndefined();
  });

  it('counts a card with damage already on it', () => {
    const wounded = [target('a', 2, 2), target('b', 3)];
    expect(damageAssignmentProblem(wounded, [{ instanceId: 'a', damage: 1 }], 1)).toMatch(
      /beyond mortally wounded/,
    );
    expect(damageAssignmentProblem(wounded, [{ instanceId: 'b', damage: 1 }], 1)).toBeUndefined();
  });

  it('needs exactly the damage owed, or none without targets', () => {
    expect(damageAssignmentProblem(TARGETS, [{ instanceId: 'a', damage: 1 }], 2)).toMatch(
      /exactly 2/,
    );
    expect(damageAssignmentProblem([], [], 3)).toBeUndefined();
  });

  it('refuses unknown, repeated and non-positive entries', () => {
    expect(damageAssignmentProblem(TARGETS, [{ instanceId: 'z', damage: 1 }], 1)).toBeDefined();
    expect(
      damageAssignmentProblem(
        TARGETS,
        [
          { instanceId: 'a', damage: 1 },
          { instanceId: 'a', damage: 1 },
        ],
        2,
      ),
    ).toBeDefined();
    expect(damageAssignmentProblem(TARGETS, [{ instanceId: 'a', damage: 0 }], 0)).toBeDefined();
  });
});
