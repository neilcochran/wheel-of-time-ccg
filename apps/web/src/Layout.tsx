import type { ReactElement } from 'react';
import { Link, NavLink, Outlet } from 'react-router';

/**
 * The frame around every page: a header linking home and to each section,
 * then the page.
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
        <nav className="site-nav" aria-label="Sections">
          <NavLink to="/cards">Cards</NavLink>
          <NavLink to="/decks">Decks</NavLink>
        </nav>
      </header>
      <main className="site-main">
        <Outlet />
      </main>
    </>
  );
}
