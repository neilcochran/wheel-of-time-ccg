/**
 * Seeded pseudo-random numbers.
 *
 * The generator's whole state is four unsigned 32-bit integers kept in the game
 * state, so the state stays plain JSON and a game replays exactly from its
 * seed. The algorithm is sfc32: small, fast and statistically sound, though not
 * cryptographic, which dice and shuffles do not need.
 */

/** Generator state: four unsigned 32-bit integers. */
export type RandomState = readonly [number, number, number, number];

/** A value drawn from the generator and the state to continue from. */
export interface RandomResult<T> {
  /** The value drawn. */
  readonly value: T;
  /** The generator state after the draw. */
  readonly state: RandomState;
}

/** Outputs discarded after seeding, so similar seeds diverge before first use. */
const WARM_UP_DRAWS = 15;

/** Size of the unsigned 32-bit range. */
const UINT32_RANGE = 2 ** 32;

/**
 * Create a generator state from a seed.
 *
 * @param seed - Up to four integers, each reduced to 32 bits. Missing values are zero.
 * @returns The generator state, already warmed up.
 */
export function seedRandom(seed: readonly number[]): RandomState {
  let state: RandomState = [
    (seed[0] ?? 0) >>> 0,
    (seed[1] ?? 0) >>> 0,
    (seed[2] ?? 0) >>> 0,
    (seed[3] ?? 0) >>> 0,
  ];
  for (let draw = 0; draw < WARM_UP_DRAWS; draw += 1) {
    state = nextUint32(state).state;
  }
  return state;
}

/**
 * Draw an unsigned 32-bit integer.
 *
 * @param state - The generator state.
 * @returns A value in `[0, 2^32)` and the next state.
 */
export function nextUint32(state: RandomState): RandomResult<number> {
  const [a, b, c, d] = state;
  let t = (a + b) | 0;
  const nextA = b ^ (b >>> 9);
  const nextB = (c + (c << 3)) | 0;
  let nextC = (c << 21) | (c >>> 11);
  const nextD = (d + 1) | 0;
  t = (t + nextD) | 0;
  nextC = (nextC + t) | 0;
  return {
    value: t >>> 0,
    state: [nextA >>> 0, nextB >>> 0, nextC >>> 0, nextD >>> 0],
  };
}

/**
 * Draw an integer uniformly from `[0, bound)`.
 *
 * Draws that fall in the incomplete final block of the 32-bit range are
 * rejected, so no value is favoured.
 *
 * @param state - The generator state.
 * @param bound - Exclusive upper bound, a positive integer no greater than 2^32.
 * @returns The value and the next state.
 */
export function randomInt(state: RandomState, bound: number): RandomResult<number> {
  const limit = UINT32_RANGE - (UINT32_RANGE % bound);
  let draw = nextUint32(state);
  while (draw.value >= limit) {
    draw = nextUint32(draw.state);
  }
  return { value: draw.value % bound, state: draw.state };
}

/**
 * Shuffle items into a new array with a Fisher-Yates shuffle.
 *
 * @param state - The generator state.
 * @param items - The items to shuffle. Not modified.
 * @returns The shuffled copy and the next state.
 */
export function shuffle<T>(state: RandomState, items: readonly T[]): RandomResult<T[]> {
  const shuffled = [...items];
  let current = state;
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const draw = randomInt(current, index + 1);
    current = draw.state;
    const picked = shuffled[draw.value];
    const displaced = shuffled[index];
    if (picked !== undefined && displaced !== undefined) {
      shuffled[index] = picked;
      shuffled[draw.value] = displaced;
    }
  }
  return { value: shuffled, state: current };
}
