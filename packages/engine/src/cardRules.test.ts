import { describe, expect, it } from 'vitest';

import {
  NO_MODIFIERS,
  allyGroupProblem,
  controlProblem,
  currentAbility,
  damageUntilMortallyWounded,
  isMortallyWounded,
} from './cardRules.ts';
import type { CardInstance } from './state.ts';
import { makeCard } from './testCards.ts';

const TROLLOCS = makeCard({
  id: 'trollocs',
  type: 'Troop',
  allegiances: ['Dark One'],
  traits: ['Monster'],
});
const FADE = makeCard({ id: 'fade', type: 'Character', allegiances: ['Dark One'] });
const DARKFRIEND = makeCard({ id: 'darkfriend', type: 'Character', allegiances: ['Cairhien'] });
const WHITECLOAK = makeCard({
  id: 'whitecloak',
  type: 'Character',
  allegiances: ['Children of the Light', 'Andor'],
});
const SELLSWORD = makeCard({ id: 'sellsword', type: 'Troop', allegiances: ['Mercenary'] });
const RAND = makeCard({
  id: 'rand',
  type: 'Character',
  allegiances: ['Dragon'],
  traits: ["Ta'veren"],
  abilities: {
    politics: { ability: 2 },
    intrigue: {},
    onePower: { ability: 3 },
    combat: { ability: 1 },
  },
});

/**
 * An instance of Rand with the given damage and modifiers.
 *
 * @param damage - Damage tokens.
 * @param onePower - Lasting One Power modifier.
 * @returns The instance.
 */
function randInstance(damage: number, onePower = 0): CardInstance {
  return {
    id: 'rand-1',
    cardId: 'rand',
    owner: 'hero',
    rotated: false,
    damage,
    lastingModifiers: { ...NO_MODIFIERS, onePower },
    turnModifiers: NO_MODIFIERS,
  };
}

describe('abilities and damage', () => {
  it('lowers every ability by damage, never below zero', () => {
    expect(currentAbility(randInstance(2), RAND, 'onePower')).toBe(1);
    expect(currentAbility(randInstance(2), RAND, 'combat')).toBe(0);
    expect(currentAbility(randInstance(0, 2), RAND, 'onePower')).toBe(5);
  });

  it('is mortally wounded once damage takes every ability to zero', () => {
    expect(isMortallyWounded(randInstance(0), RAND)).toBe(false);
    expect(isMortallyWounded(randInstance(2), RAND)).toBe(false);
    expect(isMortallyWounded(randInstance(3), RAND)).toBe(true);
    expect(damageUntilMortallyWounded(randInstance(1), RAND)).toBe(2);
    expect(damageUntilMortallyWounded(randInstance(4), RAND)).toBe(0);
  });

  it('needs at least one damage to mortally wound a card with no abilities', () => {
    const blank = makeCard({ id: 'blank', type: 'Troop' });
    expect(damageUntilMortallyWounded({ ...randInstance(0), cardId: 'blank' }, blank)).toBe(1);
  });
});

describe('controlProblem', () => {
  it("keeps Dark One from the Hero player and Dragon and Ta'veren from the Villain player", () => {
    expect(controlProblem('hero', FADE)).toBeDefined();
    expect(controlProblem('villain', FADE)).toBeUndefined();
    expect(controlProblem('villain', RAND)).toBeDefined();
    const taverenOnly = makeCard({ id: 'mat', type: 'Character', traits: ["Ta'veren"] });
    expect(controlProblem('villain', taverenOnly)).toMatch(/Ta'veren/);
  });
});

describe('allyGroupProblem', () => {
  it('lets Monsters participate only alongside Dark One or Monster cards', () => {
    expect(allyGroupProblem([TROLLOCS, FADE])).toBeUndefined();
    expect(allyGroupProblem([TROLLOCS, FADE, DARKFRIEND])).toMatch(/Monster/);
    expect(allyGroupProblem([DARKFRIEND, TROLLOCS])).toMatch(/Monster/);
  });

  it('lets Children of the Light participate alongside shared allegiances or Mercenaries', () => {
    const andoran = makeCard({ id: 'andoran', type: 'Character', allegiances: ['Andor'] });
    expect(allyGroupProblem([WHITECLOAK, andoran, SELLSWORD])).toBeUndefined();
    expect(allyGroupProblem([WHITECLOAK, DARKFRIEND])).toMatch(/Children of the Light/);
  });

  it('allows two copies of the same card', () => {
    expect(allyGroupProblem([TROLLOCS, TROLLOCS])).toBeUndefined();
  });
});
