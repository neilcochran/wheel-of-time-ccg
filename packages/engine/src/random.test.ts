import { describe, expect, it } from 'vitest';

import { nextUint32, randomInt, seedRandom, shuffle } from './random.ts';
import type { RandomState } from './random.ts';

/**
 * Draw several integers in a row.
 *
 * @param state - The starting state.
 * @param bound - Exclusive upper bound.
 * @param count - How many to draw.
 * @returns The values in order.
 */
function draws(state: RandomState, bound: number, count: number): number[] {
  const values: number[] = [];
  let current = state;
  for (let index = 0; index < count; index += 1) {
    const draw = randomInt(current, bound);
    values.push(draw.value);
    current = draw.state;
  }
  return values;
}

describe('seeded random numbers', () => {
  it('repeats exactly from the same seed and differs between seeds', () => {
    expect(draws(seedRandom([1, 2, 3, 4]), 1000, 20)).toEqual(
      draws(seedRandom([1, 2, 3, 4]), 1000, 20),
    );
    expect(draws(seedRandom([1, 2, 3, 4]), 1000, 20)).not.toEqual(
      draws(seedRandom([1, 2, 3, 5]), 1000, 20),
    );
  });

  it('keeps state as unsigned 32-bit integers', () => {
    let state = seedRandom([0xffffffff, -1, 7]);
    for (let index = 0; index < 100; index += 1) {
      const draw = nextUint32(state);
      state = draw.state;
      expect(draw.value).toBeGreaterThanOrEqual(0);
      expect(draw.value).toBeLessThan(2 ** 32);
      for (const part of state) {
        expect(Number.isInteger(part) && part >= 0 && part < 2 ** 32).toBe(true);
      }
    }
  });

  it('draws every value in range and nothing outside it', () => {
    const values = draws(seedRandom([42]), 6, 600);
    expect(new Set(values)).toEqual(new Set([0, 1, 2, 3, 4, 5]));
  });

  it('shuffles into a permutation without touching the input', () => {
    const items = Array.from({ length: 30 }, (_, index) => index);
    const result = shuffle(seedRandom([9]), items);
    expect(result.value).not.toEqual(items);
    expect([...result.value].sort((a, b) => a - b)).toEqual(items);
    expect(items[0]).toBe(0);
  });
});
