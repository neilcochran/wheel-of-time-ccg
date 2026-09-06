import { describe, expect, it } from 'vitest';

import { findUnknownSymbolTokens, parseCardText } from './text.ts';

describe('parseCardText', () => {
  it('returns a single run for text with no tokens', () => {
    expect(parseCardText('Draw a card.')).toEqual([{ kind: 'text', text: 'Draw a card.' }]);
  });

  it('splits literal runs around symbols', () => {
    expect(parseCardText('[Combat] then [Damage]')).toEqual([
      { kind: 'symbol', symbol: 'combat', count: 1 },
      { kind: 'text', text: ' then ' },
      { kind: 'symbol', symbol: 'damage', count: 1 },
    ]);
  });

  it('reads a leading repeat count', () => {
    expect(parseCardText('[3x Combat]')).toEqual([{ kind: 'symbol', symbol: 'combat', count: 3 }]);
  });

  it('reads a trailing repeat count', () => {
    expect(parseCardText('[Combat Icon x2]')).toEqual([
      { kind: 'symbol', symbol: 'combat', count: 2 },
    ]);
  });

  it('treats die faces as their game terms', () => {
    expect(parseCardText('[Sword][Shield][Skull]')).toEqual([
      { kind: 'symbol', symbol: 'support', count: 1 },
      { kind: 'symbol', symbol: 'opposition', count: 1 },
      { kind: 'symbol', symbol: 'damage', count: 1 },
    ]);
  });

  it('accepts a multi-word symbol name', () => {
    expect(parseCardText('[One Power Icon]')).toEqual([
      { kind: 'symbol', symbol: 'onePower', count: 1 },
    ]);
  });

  it('requires whitespace before a stripped icon suffix', () => {
    expect(parseCardText('[combaticon]')).toBeUndefined();
  });

  it('rejects an unrecognised token', () => {
    expect(parseCardText('[Sunburst]')).toBeUndefined();
  });

  it('leaves an unclosed bracket as literal text', () => {
    expect(parseCardText('costs [Combat')).toEqual([{ kind: 'text', text: 'costs [Combat' }]);
  });
});

describe('findUnknownSymbolTokens', () => {
  it('is empty when every token parses', () => {
    expect(findUnknownSymbolTokens('[Combat] and [2x Damage]')).toEqual([]);
  });

  it('reports unknown tokens with their brackets', () => {
    expect(findUnknownSymbolTokens('[Combat] and [Sunburst]')).toEqual(['[Sunburst]']);
  });
});

// These inputs are the shapes CodeQL flagged as polynomial backtracking against
// the regular expressions this module used to use. Each ran in quadratic time;
// the per-test timeout is the regression guard.
describe('pathological input', () => {
  const LENGTH = 50_000;

  it('handles many unclosed brackets', () => {
    const text = '['.repeat(LENGTH);
    expect(parseCardText(text)).toEqual([{ kind: 'text', text }]);
  }, 1000);

  it('handles a long whitespace run inside a token', () => {
    expect(parseCardText(`[9x ${' '.repeat(LENGTH)}\n]`)).toBeUndefined();
  }, 1000);

  it('handles a long whitespace run with no icon suffix', () => {
    expect(parseCardText(`[${' '.repeat(LENGTH)}]`)).toBeUndefined();
  }, 1000);
});
