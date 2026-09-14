/**
 * The four custom dice.
 *
 * The rulebook names the symbols but never lists the faces. These are read off
 * the game's die sticker sheet, one row of six stickers per die. A face may
 * show two symbols, in which case it produces both.
 */

import type { AbilityTrack } from '@wot/cards';

import { randomInt } from './random.ts';
import type { RandomResult, RandomState } from './random.ts';

/**
 * A symbol a die face can show.
 *
 * `ability` is the die's own ability symbol: the open book on a Politics die,
 * the goblet on Intrigue, the Aes Sedai symbol on One Power and the rider on
 * Combat.
 */
export type DieSymbol = 'ability' | 'support' | 'opposition' | 'damage';

/** The symbols one face shows. */
export type DieFace = readonly DieSymbol[];

/** The six faces of each die. */
export const DIE_FACES: Readonly<Record<AbilityTrack, readonly DieFace[]>> = {
  politics: [
    ['ability'],
    ['ability', 'support'],
    ['support'],
    ['opposition', 'support'],
    ['ability', 'opposition'],
    ['opposition'],
  ],
  intrigue: [
    ['ability'],
    ['damage', 'support'],
    ['ability', 'support'],
    ['opposition', 'support'],
    ['ability', 'opposition'],
    ['opposition'],
  ],
  onePower: [
    ['ability'],
    ['ability', 'support'],
    ['support'],
    ['opposition', 'support'],
    ['opposition'],
    ['damage'],
  ],
  combat: [
    ['ability'],
    ['ability', 'support'],
    ['support'],
    ['opposition'],
    ['damage', 'opposition'],
    ['damage'],
  ],
};

/** How many of each symbol a set of dice produced. */
export interface DiceTally {
  /** Ability symbols of the rolled track. */
  readonly ability: number;
  /** Support symbols. */
  readonly support: number;
  /** Opposition symbols. */
  readonly opposition: number;
  /** Damage symbols. */
  readonly damage: number;
}

/** A tally with nothing in it. */
export const EMPTY_TALLY: DiceTally = { ability: 0, support: 0, opposition: 0, damage: 0 };

/**
 * Roll one die.
 *
 * @param state - The generator state.
 * @param track - Which die.
 * @returns The face rolled and the next state.
 */
export function rollDie(state: RandomState, track: AbilityTrack): RandomResult<DieFace> {
  const faces = DIE_FACES[track];
  const draw = randomInt(state, faces.length);
  return { value: faces[draw.value] ?? [], state: draw.state };
}

/**
 * Add one face's symbols to a tally.
 *
 * @param tally - The running tally.
 * @param face - The face rolled.
 * @returns The new tally.
 */
export function addFace(tally: DiceTally, face: DieFace): DiceTally {
  return {
    ability: tally.ability + (face.includes('ability') ? 1 : 0),
    support: tally.support + (face.includes('support') ? 1 : 0),
    opposition: tally.opposition + (face.includes('opposition') ? 1 : 0),
    damage: tally.damage + (face.includes('damage') ? 1 : 0),
  };
}

/**
 * Roll several dice of one track and tally the results.
 *
 * @param state - The generator state.
 * @param track - Which die.
 * @param count - How many dice. Zero or less rolls nothing.
 * @returns The tally and the next state.
 */
export function rollDice(
  state: RandomState,
  track: AbilityTrack,
  count: number,
): RandomResult<DiceTally> {
  let tally = EMPTY_TALLY;
  let current = state;
  for (let die = 0; die < count; die += 1) {
    const roll = rollDie(current, track);
    tally = addFace(tally, roll.value);
    current = roll.state;
  }
  return { value: tally, state: current };
}
