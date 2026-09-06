import type { CardRarity, RarityClass, RarityCode } from './types.ts';

/**
 * The rarity class and print sheet frequency each source code stands for.
 *
 * `F` and `P` have no frequency: fixed cards came in starter decks and promos
 * were handed out, so neither was collated into boosters. The importer asserts
 * that every other code fills its set's print sheets exactly.
 */
const RARITY_BY_CODE: Readonly<
  Record<RarityCode, { class: RarityClass; sheetFrequency?: number }>
> = {
  C: { class: 'Common', sheetFrequency: 2 },
  U: { class: 'Uncommon', sheetFrequency: 2 },
  U1: { class: 'Uncommon', sheetFrequency: 1 },
  R: { class: 'Rare', sheetFrequency: 1 },
  R1: { class: 'Rare', sheetFrequency: 1 },
  R2: { class: 'Rare', sheetFrequency: 2 },
  R3: { class: 'Rare', sheetFrequency: 3 },
  F: { class: 'Fixed' },
  'F/C': { class: 'Fixed/Common', sheetFrequency: 2 },
  P: { class: 'Promo' },
};

/** Codes that name a print group, and so are shown alongside the class. */
const NUMBERED_CODES: ReadonlySet<RarityCode> = new Set<RarityCode>(['R1', 'R2', 'R3', 'U1']);

/**
 * Expand a source rarity code into its class and print sheet frequency.
 *
 * @param code - The rarity code from the source data.
 * @returns The rarity, with `sheetFrequency` present only for codes that were
 *          collated into booster packs.
 */
export function toCardRarity(code: RarityCode): CardRarity {
  const mapped = RARITY_BY_CODE[code];
  return mapped.sheetFrequency === undefined
    ? { code, class: mapped.class }
    : { code, class: mapped.class, sheetFrequency: mapped.sheetFrequency };
}

/**
 * Format a rarity for display, for example `Rare` or `Rare (R2)`.
 *
 * The numbered codes are shown alongside the class, so a plain `Rare` means a
 * Premiere rare and nothing else.
 *
 * @param rarity - The rarity to format.
 * @returns The rarity class, with the code appended when the code is numbered.
 */
export function formatRarity(rarity: CardRarity): string {
  return NUMBERED_CODES.has(rarity.code) ? `${rarity.class} (${rarity.code})` : rarity.class;
}
