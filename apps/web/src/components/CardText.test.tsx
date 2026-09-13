import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { CardText } from './CardText.tsx';

afterEach(cleanup);

describe('CardText', () => {
  it('renders each symbol token as a labelled badge', () => {
    render(<CardText text="Gain [politics][onePower]." />);
    const badges = screen.getAllByRole('img');
    expect(badges.map((badge) => badge.getAttribute('aria-label'))).toEqual([
      'Politics',
      'One Power',
    ]);
  });

  it('keeps the prose around the symbols', () => {
    const { container } = render(<CardText text="Gain [combat] now." />);
    expect(container.textContent).toBe('Gain C now.');
  });

  it('falls back to the raw text when a token is not a symbol', () => {
    const { container } = render(<CardText text="Pay [gold]." />);
    expect(container.textContent).toBe('Pay [gold].');
    expect(screen.queryByRole('img')).toBeNull();
  });
});
