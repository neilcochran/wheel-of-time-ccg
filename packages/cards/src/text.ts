/**
 * The single parser for the symbol references card text carries between square
 * brackets, so the UI can render icons and the importer can reject a spelling
 * it does not recognise.
 *
 * A token holds one `CardSymbol` verbatim and stands for one printed glyph. A
 * card that shows a symbol several times repeats the token, because that is
 * what the printing does: `[combat][combat][combat]`.
 *
 * The symbol notation is normalised in the stored text. The prose around it
 * matches the printed card, misprints included.
 */

/** The symbols that appear inline in card text. */
export const CARD_SYMBOLS = [
  'politics',
  'intrigue',
  'onePower',
  'combat',
  'support',
  'opposition',
  'damage',
] as const;

/** A symbol referenced inline in card text. */
export type CardSymbol = (typeof CARD_SYMBOLS)[number];

/** The symbol names, for membership tests against arbitrary token contents. */
const SYMBOL_NAMES: ReadonlySet<string> = new Set(CARD_SYMBOLS);

/**
 * Whether a string names a symbol.
 *
 * @param value - The contents of a bracketed token.
 * @returns True when the value is one of `CARD_SYMBOLS`.
 */
function isCardSymbol(value: string): value is CardSymbol {
  return SYMBOL_NAMES.has(value);
}

/** A run of literal text within card text. */
export interface CardTextRun {
  /** Discriminator. */
  readonly kind: 'text';
  /** The literal text. */
  readonly text: string;
}

/** A symbol reference within card text, standing for one printed glyph. */
export interface CardSymbolRun {
  /** Discriminator. */
  readonly kind: 'symbol';
  /** Which symbol is referenced. */
  readonly symbol: CardSymbol;
}

/** One segment of parsed card text. */
export type CardTextSegment = CardTextRun | CardSymbolRun;

/** One bracketed token located in a piece of card text. */
interface TokenMatch {
  /** Index of the opening bracket. */
  readonly start: number;
  /** Index one past the closing bracket. */
  readonly end: number;
  /** The text between the brackets. */
  readonly contents: string;
}

/**
 * Find the next bracketed token at or after an index.
 *
 * A token runs from a `[` to the next `]`. Any `[` in between is part of the
 * contents. An unclosed `[` ends the scan, since no later `[` can find a
 * closing bracket either.
 *
 * Scanning with `indexOf` keeps this linear. A pattern like `/\[([^\]]*)\]/`
 * rescans to the end of the string from every `[` it fails on, and both
 * exported functions below are entry points that take caller-supplied text.
 *
 * @param text - The text to search.
 * @param from - Index to start searching at.
 * @returns The token, or `undefined` when none remains.
 */
function nextToken(text: string, from: number): TokenMatch | undefined {
  const start = text.indexOf('[', from);
  if (start === -1) {
    return undefined;
  }
  const close = text.indexOf(']', start + 1);
  if (close === -1) {
    return undefined;
  }
  return { start, end: close + 1, contents: text.slice(start + 1, close) };
}

/**
 * Split card text into literal runs and symbol references.
 *
 * @param text - Rules or flavour text exactly as stored.
 * @returns The segments in order, or `undefined` if any bracketed token is not
 *          a recognised symbol. Returning `undefined` rather than throwing lets
 *          the importer report every bad token in one pass.
 */
export function parseCardText(text: string): CardTextSegment[] | undefined {
  const segments: CardTextSegment[] = [];
  let cursor = 0;

  let token = nextToken(text, 0);
  while (token !== undefined) {
    if (!isCardSymbol(token.contents)) {
      return undefined;
    }
    if (token.start > cursor) {
      segments.push({ kind: 'text', text: text.slice(cursor, token.start) });
    }
    segments.push({ kind: 'symbol', symbol: token.contents });
    cursor = token.end;
    token = nextToken(text, cursor);
  }

  if (cursor < text.length) {
    segments.push({ kind: 'text', text: text.slice(cursor) });
  }
  return segments;
}

/**
 * List the bracketed tokens in a piece of card text that are not recognised
 * symbols.
 *
 * @param text - Rules or flavour text exactly as stored.
 * @returns The unrecognised tokens, including their brackets. Empty when every
 *          token parses.
 */
export function findUnknownSymbolTokens(text: string): string[] {
  const unknown: string[] = [];

  let token = nextToken(text, 0);
  while (token !== undefined) {
    if (!isCardSymbol(token.contents)) {
      unknown.push(text.slice(token.start, token.end));
    }
    token = nextToken(text, token.end);
  }
  return unknown;
}
