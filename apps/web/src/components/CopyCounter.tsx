import type { ReactElement } from 'react';

import { MAX_COPIES } from '@wot/engine';

/** Props for {@link CopyCounter}. */
interface CopyCounterProps {
  /** The card's name, for the button labels. */
  readonly name: string;
  /** Copies the deck holds. */
  readonly copies: number;
  /** Called to add a copy. */
  readonly onAdd: () => void;
  /** Called to remove a copy. */
  readonly onRemove: () => void;
}

/**
 * A card's copy count with buttons to change it. Adding stops at the copy limit.
 *
 * @param props - The card name, count and change handlers.
 * @returns The counter element.
 */
export function CopyCounter({ name, copies, onAdd, onRemove }: CopyCounterProps): ReactElement {
  return (
    <span className="copy-counter">
      <button
        type="button"
        onClick={onRemove}
        disabled={copies === 0}
        aria-label={`Remove a copy of ${name}`}
      >
        -
      </button>
      <span className="copy-counter__count">{copies}</span>
      <button
        type="button"
        onClick={onAdd}
        disabled={copies >= MAX_COPIES}
        aria-label={`Add a copy of ${name}`}
      >
        +
      </button>
    </span>
  );
}
