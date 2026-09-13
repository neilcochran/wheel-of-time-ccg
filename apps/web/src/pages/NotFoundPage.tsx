import type { ReactElement } from 'react';
import { Link } from 'react-router';

/**
 * Shown for an unknown route or card id.
 *
 * @returns The page element.
 */
export function NotFoundPage(): ReactElement {
  return (
    <section className="message-page">
      <h1>Nothing here</h1>
      <p>There is no page or card at this address.</p>
      <Link to="/cards">Back to the card browser</Link>
    </section>
  );
}
