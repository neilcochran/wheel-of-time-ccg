import type { ReactElement } from 'react';
import { Link, Outlet } from 'react-router';

/**
 * The frame around every page: a header linking home, then the page.
 *
 * @returns The layout element.
 */
export function Layout(): ReactElement {
  return (
    <>
      <header className="site-header">
        <Link to="/cards" className="site-title">
          Wheel of Time CCG
        </Link>
        <span className="site-subtitle">Card browser</span>
      </header>
      <main className="site-main">
        <Outlet />
      </main>
    </>
  );
}
