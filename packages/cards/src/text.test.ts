import { describe, expect, it } from 'vitest';

import { CARD_SYMBOLS, findUnknownSymbolTokens, parseCardText } from './text.ts';

describe('parseCardText', () => {
  it('returns a single run for text with no tokens', () => {
    expect(parseCardText('Draw a card.')).toEqual([{ kind: 'text', text: 'Draw a card.' }]);
  });

  it('splits literal runs around symbols', () => {
    expect(parseCardText('[combat] then [damage]')).toEqual([
      { kind: 'symbol', symbol: 'combat' },
      { kind: 'text', text: ' then ' },
      { kind: 'symbol', symbol: 'damage' },
    ]);
  });

  it('gives a repeated symbol one segment per glyph', () => {
    expect(parseCardText('[combat][combat][combat]')).toEqual([
      { kind: 'symbol', symbol: 'combat' },
      { kind: 'symbol', symbol: 'combat' },
      { kind: 'symbol', symbol: 'combat' },
    ]);
  });

  it('parses every symbol name', () => {
    for (const symbol of CARD_SYMBOLS) {
      expect(parseCardText(`[${symbol}]`)).toEqual([{ kind: 'symbol', symbol }]);
    }
  });

  it('rejects a token that is not a symbol name exactly', () => {
    for (const token of ['[Combat]', '[combat icon]', '[3x combat]', '[ combat ]', '[sword]']) {
      expect(parseCardText(token)).toBeUndefined();
    }
  });

  it('rejects an unrecognised token', () => {
    expect(parseCardText('[sunburst]')).toBeUndefined();
  });

  it('leaves an unclosed bracket as literal text', () => {
    expect(parseCardText('costs [combat')).toEqual([{ kind: 'text', text: 'costs [combat' }]);
  });
});

describe('findUnknownSymbolTokens', () => {
  it('is empty when every token parses', () => {
    expect(findUnknownSymbolTokens('[combat] and [damage][damage]')).toEqual([]);
  });

  it('reports unknown tokens with their brackets', () => {
    expect(findUnknownSymbolTokens('[combat] and [sunburst]')).toEqual(['[sunburst]']);
  });
});

// Both exported functions take caller-supplied text, so the bracket scan is an
// entry point. The per-test timeout guards it against superlinear behaviour.
describe('pathological input', () => {
  const LENGTH = 50_000;

  it('handles many unclosed brackets', () => {
    const text = '['.repeat(LENGTH);
    expect(parseCardText(text)).toEqual([{ kind: 'text', text }]);
    expect(findUnknownSymbolTokens(text)).toEqual([]);
  }, 1000);

  it('handles a long run inside a token', () => {
    expect(parseCardText(`[${' '.repeat(LENGTH)}]`)).toBeUndefined();
  }, 1000);
});
