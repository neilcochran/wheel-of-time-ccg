import type { CardRarity, RarityClass, RarityCode, RarityGroup } from './types.ts';

/**
 * How each source rarity code maps onto a display class and, where the set
 * collates a class into several groups, which group the card belongs to.
 *
 * Derived from the official per-set rarity lists, whose group headings and
 * counts match the source CSVs exactly:
 *
 * - Premiere: Fixed (47), Fixed/Common (3), Common (72), Uncommon (75), Rare (100)
 * - Dark Prophecies: Common (50), Uncommon (49), Uncommon (U1) (2), Rare (34), Rare (R1) (8), Rare (R3) (8)
 * - Children of the Dragon: Common (50), Uncommon (50), Rare (46), Rare (R1) (8)
 * - Cycles: Fixed (4)
 *
 * Note that `R2` is not a third tier of rare. It is how the source data encodes
 * the group the rarity lists label plainly as "Rare", which is the largest rare
 * group in both sets that use groups.
 */
const RARITY_BY_CODE: Readonly<Record<RarityCode, { class: RarityClass; group?: RarityGroup }>> = {
    C: { class: 'Common' },
    U: { class: 'Uncommon' },
    U1: { class: 'Uncommon', group: 'U1' },
    R: { class: 'Rare' },
    R1: { class: 'Rare', group: 'R1' },
    R2: { class: 'Rare' },
    R3: { class: 'Rare', group: 'R3' },
    F: { class: 'Fixed' },
    'F/C': { class: 'Fixed/Common' },
    P: { class: 'Promo' },
};

/**
 * Expand a source rarity code into its display class and print group.
 *
 * @param code - The rarity code from the source data.
 * @returns The rarity, with `group` present only when the code names one.
 */
export function toCardRarity(code: RarityCode): CardRarity {
    const mapped = RARITY_BY_CODE[code];
    return mapped.group === undefined
        ? { code, class: mapped.class }
        : { code, class: mapped.class, group: mapped.group };
}

/**
 * Format a rarity for display, for example `Rare` or `Rare (R1)`.
 *
 * @param rarity - The rarity to format.
 * @returns The rarity class, with the print group appended when there is one.
 */
export function formatRarity(rarity: CardRarity): string {
    return rarity.group === undefined ? rarity.class : `${rarity.class} (${rarity.group})`;
}
