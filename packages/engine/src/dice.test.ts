import { describe, expect, it } from 'vitest';

import { ABILITY_TRACKS } from '@wot/cards';
import type { AbilityTrack } from '@wot/cards';

import { DIE_FACES, EMPTY_TALLY, addFace, rollDice } from './dice.ts';
import type { DiceTally } from './dice.ts';
import { seedRandom } from './random.ts';

/** Faces showing each symbol, as counted off the sticker sheet. */
const SHEET_COUNTS: Readonly<Record<AbilityTrack, DiceTally>> = {
  politics: { ability: 3, support: 3, opposition: 3, damage: 0 },
  intrigue: { ability: 3, support: 3, opposition: 3, damage: 1 },
  onePower: { ability: 2, support: 3, opposition: 2, damage: 1 },
  combat: { ability: 2, support: 2, opposition: 2, damage: 2 },
};

describe('dice', () => {
  it('match the sticker sheet', () => {
    for (const track of ABILITY_TRACKS) {
      const faces = DIE_FACES[track];
      expect(faces).toHaveLength(6);
      expect(faces.reduce(addFace, EMPTY_TALLY)).toEqual(SHEET_COUNTS[track]);
    }
  });

  it('roll the same results from the same state', () => {
    const state = seedRandom([5]);
    expect(rollDice(state, 'combat', 10)).toEqual(rollDice(state, 'combat', 10));
  });

  it('roll nothing for zero dice and keep the state', () => {
    const state = seedRandom([5]);
    expect(rollDice(state, 'intrigue', 0)).toEqual({ value: EMPTY_TALLY, state });
  });

  it('never produce damage from Politics dice', () => {
    expect(rollDice(seedRandom([11]), 'politics', 200).value.damage).toBe(0);
  });
});
