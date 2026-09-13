import type { AbilityTrack, CardSymbol } from '@wot/cards';

/** Display names for the four ability tracks. */
export const ABILITY_TRACK_LABELS: Readonly<Record<AbilityTrack, string>> = {
  politics: 'Politics',
  intrigue: 'Intrigue',
  onePower: 'One Power',
  combat: 'Combat',
};

/** Display names for the symbols that appear inline in card text. */
export const CARD_SYMBOL_LABELS: Readonly<Record<CardSymbol, string>> = {
  politics: 'Politics',
  intrigue: 'Intrigue',
  onePower: 'One Power',
  combat: 'Combat',
  support: 'Support',
  opposition: 'Opposition',
  damage: 'Damage',
};
