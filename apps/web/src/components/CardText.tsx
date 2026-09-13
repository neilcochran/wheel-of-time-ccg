import { Fragment } from 'react';
import type { ReactElement } from 'react';

import { parseCardText } from '@wot/cards';

import { CardSymbolBadge } from './CardSymbolBadge.tsx';

/** Props for {@link CardText}. */
interface CardTextProps {
  /** Rules or flavour text exactly as stored, with bracketed symbol tokens. */
  readonly text: string;
}

/**
 * Card text with its symbol tokens rendered as badges.
 *
 * The stored text is validated at import time, so an unparseable token is
 * unexpected; the raw text is shown rather than nothing.
 *
 * @param props - The text.
 * @returns The rendered runs.
 */
export function CardText({ text }: CardTextProps): ReactElement {
  const segments = parseCardText(text);
  if (segments === undefined) {
    return <>{text}</>;
  }
  return (
    <>
      {segments.map((segment, index) =>
        segment.kind === 'text' ? (
          <Fragment key={index}>{segment.text}</Fragment>
        ) : (
          <CardSymbolBadge key={index} symbol={segment.symbol} />
        ),
      )}
    </>
  );
}
