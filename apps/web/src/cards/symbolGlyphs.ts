import type { CardSymbol } from '@wot/cards';

import combat from '../assets/symbols/combat.png';
import damage from '../assets/symbols/damage.png';
import intrigue from '../assets/symbols/intrigue.png';
import onePower from '../assets/symbols/onePower.png';
import opposition from '../assets/symbols/opposition.png';
import politics from '../assets/symbols/politics.png';
import support from '../assets/symbols/support.png';

/**
 * Artwork for every symbol that can appear in card text, as image URLs.
 *
 * The glyphs are the ones printed on the game's dice: an open book for
 * Politics, a goblet for Intrigue, the Aes Sedai symbol for One Power, a mounted
 * rider for Combat, a dagger for Support, a shield for Opposition and a skull
 * for Damage. Each is 64 px tall on a transparent background, which is about
 * three times its rendered height.
 */
export const CARD_SYMBOL_GLYPHS: Readonly<Record<CardSymbol, string>> = {
  politics,
  intrigue,
  onePower,
  combat,
  support,
  opposition,
  damage,
};
