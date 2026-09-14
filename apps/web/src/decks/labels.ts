import type { DeckReport, Deck, DeckSide } from '@wot/engine';

/** Display names for the two sides. */
export const DECK_SIDE_LABELS: Readonly<Record<DeckSide, string>> = {
  hero: 'Hero deck',
  villain: 'Villain deck',
};

/**
 * A deck's name for display, standing in for a blank one.
 *
 * @param deck - The deck.
 * @returns The name, or "Untitled deck" when it is blank.
 */
export function deckDisplayName(deck: Deck): string {
  return deck.name.trim() === '' ? 'Untitled deck' : deck.name;
}

/**
 * A one-phrase summary of a deck's legality.
 *
 * @param report - The deck's legality report.
 * @returns "Not legal", "Legal" or "Tournament legal".
 */
export function legalityLabel(report: DeckReport): string {
  if (report.errors.length > 0) {
    return 'Not legal';
  }
  if (report.tournamentProblems.length > 0) {
    return 'Legal';
  }
  return 'Tournament legal';
}
