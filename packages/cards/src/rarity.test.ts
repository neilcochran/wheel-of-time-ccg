import { describe, expect, it } from 'vitest';

import { formatRarity, toCardRarity } from './rarity.ts';
import { RARITY_CODES } from './types.ts';

describe('toCardRarity', () => {
  it('gives every code a class', () => {
    for (const code of RARITY_CODES) {
      expect(toCardRarity(code).class).toBeTruthy();
    }
  });

  it('omits the sheet frequency for cards that were never in boosters', () => {
    expect(toCardRarity('F')).toEqual({ code: 'F', class: 'Fixed' });
    expect(toCardRarity('P')).toEqual({ code: 'P', class: 'Promo' });
  });

  it('gives every other code a sheet frequency', () => {
    for (const code of RARITY_CODES) {
      if (code === 'F' || code === 'P') {
        continue;
      }
      expect(toCardRarity(code).sheetFrequency).toBeGreaterThan(0);
    }
  });

  it('orders scarcity within the rare class', () => {
    expect(toCardRarity('R1').sheetFrequency).toBe(1);
    expect(toCardRarity('R2').sheetFrequency).toBe(2);
    expect(toCardRarity('R3').sheetFrequency).toBe(3);
  });

  it('makes a Premiere rare as scarce as an R1', () => {
    expect(toCardRarity('R').sheetFrequency).toBe(toCardRarity('R1').sheetFrequency);
  });
});

describe('formatRarity', () => {
  it('shows the code for numbered rarities', () => {
    expect(formatRarity(toCardRarity('R1'))).toBe('Rare (R1)');
    expect(formatRarity(toCardRarity('R2'))).toBe('Rare (R2)');
    expect(formatRarity(toCardRarity('R3'))).toBe('Rare (R3)');
    expect(formatRarity(toCardRarity('U1'))).toBe('Uncommon (U1)');
  });

  it('shows the class alone for unnumbered rarities', () => {
    expect(formatRarity(toCardRarity('R'))).toBe('Rare');
    expect(formatRarity(toCardRarity('U'))).toBe('Uncommon');
    expect(formatRarity(toCardRarity('C'))).toBe('Common');
    expect(formatRarity(toCardRarity('F'))).toBe('Fixed');
    expect(formatRarity(toCardRarity('F/C'))).toBe('Fixed/Common');
    expect(formatRarity(toCardRarity('P'))).toBe('Promo');
  });
});
