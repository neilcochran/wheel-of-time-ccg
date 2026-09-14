import { describe, expect, it } from 'vitest';

import type { AbilityTrack, Allegiance, Card } from '@wot/cards';

import { checkPrintedPayment, checkRecruitPayment, describeCost } from './cost.ts';
import type { PaymentSymbol } from './cost.ts';
import { makeCard } from './testCards.ts';

/**
 * Make several identical payment symbols.
 *
 * @param count - How many.
 * @param track - Which ability.
 * @param allegiances - Their allegiances.
 * @returns The symbols.
 */
function symbols(
  count: number,
  track: AbilityTrack,
  ...allegiances: Allegiance[]
): PaymentSymbol[] {
  return Array.from({ length: count }, () => ({ track, allegiances }));
}

/** A Tear character costing 1 Politics with Dark Nature, from the rulebook's example. */
const DARK_TEAR: Card = makeCard({
  id: 'dark-tear',
  type: 'Character',
  allegiances: ['Tear'],
  traits: ['Dark Nature'],
  abilities: { politics: { ability: 1, cost: 1 }, intrigue: {}, onePower: {}, combat: {} },
});

/** Elayne Trakand as the rulebook's example has her: Andor, Light Nature, 2 Politics. */
const ELAYNE: Card = makeCard({
  id: 'elayne',
  type: 'Character',
  allegiances: ['Andor'],
  traits: ['Light Nature'],
  abilities: { politics: { ability: 3, cost: 2 }, intrigue: {}, onePower: {}, combat: {} },
});

/** Lord Pelivar as the rulebook's example has him: Andor, 2 Politics and 1 Combat. */
const PELIVAR: Card = makeCard({
  id: 'pelivar',
  type: 'Character',
  allegiances: ['Andor'],
  abilities: {
    politics: { ability: 2, cost: 2 },
    intrigue: {},
    onePower: {},
    combat: { ability: 1, cost: 1 },
  },
});

describe('checkRecruitPayment', () => {
  it('takes the printed cost in symbols sharing an allegiance', () => {
    const payment = [
      ...symbols(2, 'politics', 'Andor', 'Dragon'),
      ...symbols(1, 'combat', 'Andor'),
    ];
    expect(checkRecruitPayment(PELIVAR, 'hero', payment, 0)).toEqual({
      ok: true,
      value: { politics: 2, intrigue: 0, onePower: 0, combat: 1 },
    });
  });

  it('doubles for allegiance and nature, cumulatively', () => {
    const result = checkRecruitPayment(DARK_TEAR, 'hero', symbols(4, 'politics', 'Cairhien'), 0);
    expect(result).toEqual({
      ok: true,
      value: { politics: 4, intrigue: 0, onePower: 0, combat: 0 },
    });
    expect(checkRecruitPayment(DARK_TEAR, 'villain', symbols(1, 'politics', 'Tear'), 0).ok).toBe(
      true,
    );
  });

  it('converts Pattern before doubling, down to nothing at all', () => {
    expect(checkRecruitPayment(ELAYNE, 'villain', symbols(8, 'politics', 'Dark One'), 0).ok).toBe(
      true,
    );
    expect(checkRecruitPayment(ELAYNE, 'villain', symbols(4, 'politics', 'Dark One'), 1).ok).toBe(
      true,
    );
    expect(checkRecruitPayment(ELAYNE, 'villain', [], 2)).toEqual({
      ok: true,
      value: { politics: 0, intrigue: 0, onePower: 0, combat: 0 },
    });
  });

  it('lets One Power stand in for any symbol, but not the reverse', () => {
    const withOnePower = [...symbols(1, 'politics', 'Andor'), ...symbols(2, 'onePower', 'Andor')];
    expect(checkRecruitPayment(PELIVAR, 'hero', withOnePower, 0).ok).toBe(true);

    const channeler = makeCard({
      id: 'channeler',
      type: 'Character',
      allegiances: ['Aes Sedai'],
      abilities: { politics: {}, intrigue: {}, onePower: { ability: 2, cost: 1 }, combat: {} },
    });
    expect(checkRecruitPayment(channeler, 'hero', symbols(1, 'politics', 'Aes Sedai'), 0).ok).toBe(
      false,
    );
  });

  it('refuses too many or too few symbols', () => {
    expect(checkRecruitPayment(DARK_TEAR, 'villain', symbols(2, 'politics', 'Tear'), 0)).toEqual({
      ok: false,
      error: 'The cost is 1 Politics, but 2 Politics was offered.',
    });
    expect(checkRecruitPayment(PELIVAR, 'hero', symbols(2, 'politics', 'Andor'), 0).ok).toBe(false);
  });

  it('needs every troop symbol to share its allegiance, unless it is Mercenary', () => {
    const troop = makeCard({
      id: 'cavalry',
      type: 'Troop',
      allegiances: ['Andor'],
      abilities: { politics: { cost: 1 }, intrigue: {}, onePower: {}, combat: { ability: 4 } },
    });
    expect(checkRecruitPayment(troop, 'hero', symbols(1, 'politics', 'Andor'), 0).ok).toBe(true);
    expect(checkRecruitPayment(troop, 'hero', symbols(2, 'politics', 'Tear'), 0).ok).toBe(false);

    const mercenaries = makeCard({ ...troop, id: 'sellswords', allegiances: ['Mercenary'] });
    expect(checkRecruitPayment(mercenaries, 'hero', symbols(1, 'politics', 'Tear'), 0).ok).toBe(
      true,
    );
  });

  it('applies the Aiel restrictions', () => {
    const aiel = makeCard({
      id: 'aiel',
      type: 'Character',
      allegiances: ['Aiel'],
      abilities: { politics: {}, intrigue: {}, onePower: {}, combat: { ability: 3, cost: 1 } },
    });
    expect(checkRecruitPayment(aiel, 'hero', symbols(2, 'combat', 'Dragon'), 0).ok).toBe(true);
    expect(checkRecruitPayment(aiel, 'hero', symbols(2, 'combat', 'Andor'), 0).ok).toBe(false);

    const aielTroop = makeCard({ ...aiel, id: 'aiel-troop', type: 'Troop' });
    expect(checkRecruitPayment(aielTroop, 'hero', symbols(1, 'combat', 'Aiel'), 0).ok).toBe(true);
    expect(checkRecruitPayment(aielTroop, 'hero', symbols(1, 'combat', 'Dragon'), 0).ok).toBe(
      false,
    );
  });

  it('only recruits characters and troops', () => {
    expect(checkRecruitPayment(makeCard({ id: 'event' }), 'hero', [], 0).ok).toBe(false);
  });
});

describe('checkPrintedPayment', () => {
  it('takes exactly the printed symbols, with no substitution', () => {
    const advantage = makeCard({
      id: 'dagger',
      type: 'Advantage',
      abilities: { politics: {}, intrigue: { cost: 1 }, onePower: {}, combat: {} },
    });
    expect(checkPrintedPayment(advantage, symbols(1, 'intrigue')).ok).toBe(true);
    expect(checkPrintedPayment(advantage, symbols(1, 'onePower')).ok).toBe(false);
    expect(checkPrintedPayment(makeCard({ id: 'free' }), []).ok).toBe(true);
  });
});

describe('describeCost', () => {
  it('lists abilities in printed order', () => {
    expect(describeCost({ politics: 2, intrigue: 0, onePower: 1, combat: 3 })).toBe(
      '2 Politics, 1 One Power and 3 Combat',
    );
    expect(describeCost({ politics: 0, intrigue: 0, onePower: 0, combat: 0 })).toBe('nothing');
  });
});
