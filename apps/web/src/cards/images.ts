import type { Card, CardPrinting, CardSetId } from '@wot/cards';

/**
 * URL of a file under `data/images`, which Vite serves as the public root.
 *
 * @param setId - The set whose directory holds the file.
 * @param file - The filename within that directory.
 * @returns A root-relative URL honouring Vite's configured base.
 */
function assetUrl(setId: CardSetId, file: string): string {
  return `${import.meta.env.BASE_URL}${setId}/${file}`;
}

/**
 * URL of a card's full-size scan.
 *
 * @param card - The card.
 * @returns The scan URL.
 */
export function cardImageUrl(card: Card): string {
  return assetUrl(card.setId, card.image);
}

/**
 * URL of a card's thumbnail.
 *
 * @param card - The card.
 * @returns The thumbnail URL.
 */
export function cardThumbnailUrl(card: Card): string {
  return assetUrl(card.setId, card.thumbnail);
}

/**
 * URL of the full-size scan of one of a card's other printings.
 *
 * @param card - The card the printing belongs to.
 * @param printing - The printing.
 * @returns The scan URL.
 */
export function printingImageUrl(card: Card, printing: CardPrinting): string {
  return assetUrl(card.setId, printing.image);
}
