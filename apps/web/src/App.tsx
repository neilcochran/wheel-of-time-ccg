import type { ReactElement } from 'react';
import { Navigate, createBrowserRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';

import { CardDatabaseProvider } from './cards/CardDatabaseProvider.tsx';
import { loadCardDatabase } from './cards/loadCardDatabase.ts';
import { Layout } from './Layout.tsx';
import { CardBrowserPage } from './pages/CardBrowserPage.tsx';
import { CardDetailPage } from './pages/CardDetailPage.tsx';
import { DatabaseErrorPage } from './pages/DatabaseErrorPage.tsx';
import { DeckEditorPage } from './pages/DeckEditorPage.tsx';
import { DeckListPage } from './pages/DeckListPage.tsx';
import { NotFoundPage } from './pages/NotFoundPage.tsx';

/** The route table. Created once, outside the tree, as the router expects. */
const router = createBrowserRouter([
  {
    path: '/',
    Component: Layout,
    children: [
      { index: true, element: <Navigate to="/cards" replace /> },
      { path: 'cards', Component: CardBrowserPage },
      { path: 'cards/:cardId', Component: CardDetailPage },
      { path: 'decks', Component: DeckListPage },
      { path: 'decks/:deckId', Component: DeckEditorPage },
      { path: '*', Component: NotFoundPage },
    ],
  },
]);

/**
 * The application root: the card database, then the router over it.
 *
 * @returns The root element.
 */
export function App(): ReactElement {
  const result = loadCardDatabase();
  if (!result.ok) {
    return <DatabaseErrorPage error={result.error} />;
  }
  return (
    <CardDatabaseProvider database={result.database}>
      <RouterProvider router={router} />
    </CardDatabaseProvider>
  );
}
