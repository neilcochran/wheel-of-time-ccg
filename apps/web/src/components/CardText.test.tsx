import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { CardText } from './CardText.tsx';

afterEach(cleanup);

describe('CardText', () => {
  it('renders each symbol token as a labelled glyph', () => {
    render(<CardText text="Gain [politics][onePower]." />);
    const glyphs = screen.getAllByRole('img');
    expect(glyphs.map((glyph) => glyph.getAttribute('alt'))).toEqual(['Politics', 'One Power']);
  });

  it('keeps the prose around the symbols', () => {
    const { container } = render(<CardText text="Gain [combat] now." />);
    expect(container.textContent).toBe('Gain  now.');
    expect(screen.getByRole('img', { name: 'Combat' }).previousSibling?.textContent).toBe('Gain ');
  });

  it('falls back to the raw text when a token is not a symbol', () => {
    const { container } = render(<CardText text="Pay [gold]." />);
    expect(container.textContent).toBe('Pay [gold].');
    expect(screen.queryByRole('img')).toBeNull();
  });
});
