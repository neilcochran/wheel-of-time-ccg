/**
 * Card rules text carries inline symbol references written between square
 * brackets. The source data spells them inconsistently: `[Combat]`,
 * `[Combat Icon]`, `[3x Combat]` and `[Combat Icon x2]` all appear, along with
 * lower-case variants. There are 43 distinct spellings.
 *
 * They resolve to seven symbols. Three of those the source names twice, once by
 * the game term and once by the picture on the die face. The rulebook settles
 * that they are the same thing: "The Support symbol is a sword", "The
 * Opposition symbol is a shield", "The Damage symbol is a skull". The game term
 * is the canonical form here.
 *
 * The stored text stays exactly as transcribed. This module is the single
 * parser for those tokens, so the UI can render icons and the importer can
 * reject a spelling it does not recognise.
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

/**
 * Every spelling of a symbol name seen in the source data, normalised.
 *
 * `sword`, `shield` and `skull` describe the die faces for support, opposition
 * and damage respectively, and are treated as the same symbols.
 */
const SYMBOL_BY_NAME: Readonly<Record<string, CardSymbol>> = {
  politics: 'politics',
  intrigue: 'intrigue',
  'one power': 'onePower',
  combat: 'combat',
  support: 'support',
  sword: 'support',
  opposition: 'opposition',
  shield: 'opposition',
  damage: 'damage',
  skull: 'damage',
};

/** A run of literal text within card text. */
export interface CardTextRun {
  /** Discriminator. */
  readonly kind: 'text';
  /** The literal text. */
  readonly text: string;
}

/** A symbol reference within card text. */
export interface CardSymbolRun {
  /** Discriminator. */
  readonly kind: 'symbol';
  /** Which symbol is referenced. */
  readonly symbol: CardSymbol;
  /** How many of the symbol, defaulting to 1 when the token gives no count. */
  readonly count: number;
}

/** One segment of parsed card text. */
export type CardTextSegment = CardTextRun | CardSymbolRun;

/** Matches a bracketed token and captures its contents. */
const TOKEN_PATTERN = /\[([^\]]*)\]/g;

/** Matches a leading repeat count, as in `3x Combat`. */
const LEADING_COUNT = /^(\d+)\s*x\s+(.*)$/;

/** Matches a trailing repeat count, as in `Combat Icon x2`. */
const TRAILING_COUNT = /^(.*?)\s+x\s*(\d+)$/;

/** Matches an optional trailing `Icon` word. */
const ICON_SUFFIX = /\s+icon$/;

/**
 * Interpret the contents of a single bracketed token.
 *
 * @param contents - The text between the brackets, without the brackets.
 * @returns The symbol and count, or `undefined` if the token is not recognised.
 */
function parseToken(contents: string): CardSymbolRun | undefined {
  let name = contents.trim();
  let count = 1;

  const leading = LEADING_COUNT.exec(name);
  if (leading?.[1] !== undefined && leading[2] !== undefined) {
    count = Number.parseInt(leading[1], 10);
    name = leading[2];
  } else {
    const trailing = TRAILING_COUNT.exec(name);
    if (trailing?.[1] !== undefined && trailing[2] !== undefined) {
      name = trailing[1];
      count = Number.parseInt(trailing[2], 10);
    }
  }

  name = name.trim().toLowerCase().replace(ICON_SUFFIX, '').trim();

  const symbol = SYMBOL_BY_NAME[name];
  if (symbol === undefined) {
    return undefined;
  }
  return { kind: 'symbol', symbol, count };
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

  TOKEN_PATTERN.lastIndex = 0;
  let match = TOKEN_PATTERN.exec(text);
  while (match !== null) {
    const contents = match[1];
    if (contents === undefined) {
      return undefined;
    }
    const parsed = parseToken(contents);
    if (parsed === undefined) {
      return undefined;
    }
    if (match.index > cursor) {
      segments.push({ kind: 'text', text: text.slice(cursor, match.index) });
    }
    segments.push(parsed);
    cursor = match.index + match[0].length;
    match = TOKEN_PATTERN.exec(text);
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
  TOKEN_PATTERN.lastIndex = 0;
  let match = TOKEN_PATTERN.exec(text);
  while (match !== null) {
    const contents = match[1];
    if (contents === undefined || parseToken(contents) === undefined) {
      unknown.push(match[0]);
    }
    match = TOKEN_PATTERN.exec(text);
  }
  return unknown;
}
