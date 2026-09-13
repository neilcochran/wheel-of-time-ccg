import type { ReactElement } from 'react';

import type { CardSymbol } from '@wot/cards';

import { CARD_SYMBOL_LABELS } from '../cards/labels.ts';
import { CARD_SYMBOL_GLYPHS } from '../cards/symbolGlyphs.ts';

/** Props for {@link CardSymbolGlyph}. */
interface CardSymbolGlyphProps {
  /** The symbol to show. */
  readonly symbol: CardSymbol;
}

/**
 * One inline symbol from card text, shown as the glyph the card prints.
 *
 * @param props - The symbol.
 * @returns The image element.
 */
export function CardSymbolGlyph({ symbol }: CardSymbolGlyphProps): ReactElement {
  const label = CARD_SYMBOL_LABELS[symbol];
  return <img className="symbol" src={CARD_SYMBOL_GLYPHS[symbol]} alt={label} title={label} />;
}
