import type { ReactElement } from 'react';

/** Props for {@link DatabaseErrorPage}. */
interface DatabaseErrorPageProps {
  /** The decoder's report of what was wrong. */
  readonly error: string;
}

/**
 * Shown when the bundled card database does not decode.
 *
 * This should never appear from a clean build, since the tests decode the
 * committed file, so when it does the message points at the offending value.
 *
 * @param props - The decode error.
 * @returns The page element.
 */
export function DatabaseErrorPage({ error }: DatabaseErrorPageProps): ReactElement {
  return (
    <section className="message-page">
      <h1>Card database failed to load</h1>
      <p>The bundled card data did not match what the app expects.</p>
      <pre>{error}</pre>
    </section>
  );
}
