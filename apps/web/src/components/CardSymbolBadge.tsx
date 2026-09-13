import type { ReactElement } from 'react';

import type { CardSymbol } from '@wot/cards';

import { CARD_SYMBOL_PRESENTATION } from '../cards/labels.ts';

/** Props for {@link CardSymbolBadge}. */
interface CardSymbolBadgeProps {
  /** The symbol to show. */
  readonly symbol: CardSymbol;
}

/**
 * One inline symbol from card text, shown as a labelled badge.
 *
 * The printed glyphs are not available as artwork yet, so the badge carries an
 * abbreviation and the symbol's colour instead.
 *
 * @param props - The symbol.
 * @returns The badge element.
 */
export function CardSymbolBadge({ symbol }: CardSymbolBadgeProps): ReactElement {
  const { label, abbreviation } = CARD_SYMBOL_PRESENTATION[symbol];
  return (
    <span className={`symbol symbol--${symbol}`} role="img" aria-label={label} title={label}>
      {abbreviation}
    </span>
  );
}
