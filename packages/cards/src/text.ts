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

/**
 * Matches a single whitespace character, the same set `\s` covers.
 *
 * The parsing below scans character by character rather than matching whole
 * tokens with a regular expression. The regular expressions this replaced
 * backtracked quadratically: `/\[([^\]]*)\]/` rescans to the end of the string
 * from every `[` it fails on, and the count patterns replayed a lazy `.*?`
 * against `\s+`. Card text is short today, but these are exported entry points.
 */
const WHITESPACE = /\s/;

/**
 * Whether a character is whitespace.
 *
 * @param char - The character, or `undefined` past the end of a string.
 * @returns True when the character exists and is whitespace.
 */
function isWhitespace(char: string | undefined): boolean {
  return char !== undefined && WHITESPACE.test(char);
}

/**
 * Whether a character is an ASCII digit.
 *
 * @param char - The character, or `undefined` past the end of a string.
 * @returns True when the character exists and is a digit.
 */
function isDigit(char: string | undefined): boolean {
  return char !== undefined && char >= '0' && char <= '9';
}

/** A repeat count split off a token name. */
interface CountSplit {
  /** The token name with the count removed. */
  readonly name: string;
  /** The repeat count. */
  readonly count: number;
}

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
 * contents, matching what the previous pattern did. An unclosed `[` ends the
 * scan, since no later `[` can find a closing bracket either.
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
 * Split a leading repeat count off a token name, as in `3x Combat`.
 *
 * @param name - The trimmed token contents.
 * @returns The count and remaining name, or `undefined` when there is none.
 */
function splitLeadingCount(name: string): CountSplit | undefined {
  let index = 0;
  while (isDigit(name[index])) {
    index += 1;
  }
  if (index === 0) {
    return undefined;
  }
  const digits = name.slice(0, index);

  while (isWhitespace(name[index])) {
    index += 1;
  }
  if (name[index] !== 'x') {
    return undefined;
  }
  index += 1;

  const afterX = index;
  while (isWhitespace(name[index])) {
    index += 1;
  }
  if (index === afterX) {
    return undefined;
  }

  return { name: name.slice(index), count: Number.parseInt(digits, 10) };
}

/**
 * Split a trailing repeat count off a token name, as in `Combat Icon x2`.
 *
 * Scanned from the end. The count is anchored to the end of the string, so the
 * split point is fixed by the trailing digits.
 *
 * @param name - The trimmed token contents.
 * @returns The count and remaining name, or `undefined` when there is none.
 */
function splitTrailingCount(name: string): CountSplit | undefined {
  let index = name.length;
  while (index > 0 && isDigit(name[index - 1])) {
    index -= 1;
  }
  if (index === name.length) {
    return undefined;
  }
  const digits = name.slice(index);

  while (index > 0 && isWhitespace(name[index - 1])) {
    index -= 1;
  }
  if (name[index - 1] !== 'x') {
    return undefined;
  }
  index -= 1;

  const beforeX = index;
  while (index > 0 && isWhitespace(name[index - 1])) {
    index -= 1;
  }
  if (index === beforeX) {
    return undefined;
  }

  return { name: name.slice(0, index), count: Number.parseInt(digits, 10) };
}

/**
 * Remove a trailing `icon` word, which the source data appends inconsistently.
 *
 * At least one whitespace character must precede it, so `combaticon` is left
 * alone.
 *
 * @param name - A lower-cased, trimmed token name.
 * @returns The name without its `icon` suffix.
 */
function stripIconSuffix(name: string): string {
  if (!name.endsWith('icon')) {
    return name;
  }
  const head = name.slice(0, -'icon'.length);
  const trimmed = head.trimEnd();
  return trimmed.length < head.length ? trimmed : name;
}

/**
 * Interpret the contents of a single bracketed token.
 *
 * @param contents - The text between the brackets, without the brackets.
 * @returns The symbol and count, or `undefined` if the token is not recognised.
 */
function parseToken(contents: string): CardSymbolRun | undefined {
  let name = contents.trim();
  let count = 1;

  const leading = splitLeadingCount(name);
  if (leading !== undefined) {
    name = leading.name;
    count = leading.count;
  } else {
    const trailing = splitTrailingCount(name);
    if (trailing !== undefined) {
      name = trailing.name;
      count = trailing.count;
    }
  }

  name = stripIconSuffix(name.trim().toLowerCase()).trim();

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

  let token = nextToken(text, 0);
  while (token !== undefined) {
    const parsed = parseToken(token.contents);
    if (parsed === undefined) {
      return undefined;
    }
    if (token.start > cursor) {
      segments.push({ kind: 'text', text: text.slice(cursor, token.start) });
    }
    segments.push(parsed);
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
    if (parseToken(token.contents) === undefined) {
      unknown.push(text.slice(token.start, token.end));
    }
    token = nextToken(text, token.end);
  }
  return unknown;
}
