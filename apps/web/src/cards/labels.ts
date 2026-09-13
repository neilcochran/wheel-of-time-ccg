import type { AbilityTrack, CardSymbol } from '@wot/cards';

/** Display names for the four ability tracks. */
export const ABILITY_TRACK_LABELS: Readonly<Record<AbilityTrack, string>> = {
  politics: 'Politics',
  intrigue: 'Intrigue',
  onePower: 'One Power',
  combat: 'Combat',
};

/** How an inline symbol is announced and, until glyph artwork exists, abbreviated. */
export interface SymbolPresentation {
  /** Full name, used for the accessible label and tooltip. */
  readonly label: string;
  /** Short text shown inside the badge in place of the printed glyph. */
  readonly abbreviation: string;
}

/** Presentation for every symbol that can appear in card text. */
export const CARD_SYMBOL_PRESENTATION: Readonly<Record<CardSymbol, SymbolPresentation>> = {
  politics: { label: 'Politics', abbreviation: 'P' },
  intrigue: { label: 'Intrigue', abbreviation: 'I' },
  onePower: { label: 'One Power', abbreviation: 'OP' },
  combat: { label: 'Combat', abbreviation: 'C' },
  support: { label: 'Support', abbreviation: '+' },
  opposition: { label: 'Opposition', abbreviation: '-' },
  damage: { label: 'Damage', abbreviation: 'D' },
};
