# Wheel of Time CCG

A web implementation of the Wheel of Time Collectible Card Game, published by
Precedence Entertainment in 1999 and out of print since the company closed in 2002.

The project runs locally. There is no hosted instance and no account system.

## Getting set up

Requires Node 24 or newer. The pnpm version is pinned by the `packageManager`
field, so `corepack pnpm install` fetches the right one on its own.

```
pnpm install
pnpm dev
```

`pnpm dev` starts the card browser on a local Vite dev server and prints its
address.

Nothing is compiled outside the browser app. Node 24 strips types from the
`.ts` sources directly, Vite compiles the app, and TypeScript only ever
type-checks, which is why imports carry `.ts` extensions.

## Building the card data

The importer itself has no dependencies and runs on bare Node.

```
pnpm import-cards
```

It validates as it goes and fails on any surprise: an unknown card type,
sub-type, rarity, allegiance, trait or inline symbol; a sub-type on a card type
that cannot carry it; an ability rating of zero, which the source data never
uses; a card with no image, or an image with no card; a duplicate card id; or a
total that is not exactly 617 printings of 616 cards.

A rebuild is a pure parse of a single file. `data/cards.csv` holds everything: card text, artist credits, and the one relationship
between rows that the publisher's own catalogue created.

Two columns are blank for all but one row. `printing_of` names the card a row is
another printing of, and `printing_note` says what distinguishes it.

The two totals differ because Dark Prophecies printed one card twice. Its name
was misprinted as "Jarette Byar", corrected to "Jaret Byar" in a later run, and
Precedence catalogued both under collector number 54. They are one card, so the
importer folds the misprint into `otherPrintings` rather than leaving two rows
that a deck builder would happily let you play six copies of.

## The card browser

`apps/web` is a React single-page app built with Vite and routed with React
Router. It has two pages: `/cards`, a filterable grid of every card, and
`/cards/<id>`, one card's scan beside everything the data records about it.

Three things about how it is put together are worth knowing:

- **The filter is the URL.** Search text, sets, types, rarities, allegiances,
  traits and sort order are all query parameters, so a filtered view can be
  bookmarked or shared. Values the vocabularies do not recognise are dropped on
  parse.
- **The card database is bundled and decoded, not fetched.** The app imports
  `packages/cards/generated/cards.json` and runs it through `decodeCardDatabase`
  from `@wot/cards` before rendering anything. A JSON import only gives
  TypeScript widened `string` fields; the decoder narrows every value back to
  the closed vocabularies and reports the path to the first value it cannot,
  which the tests also exercise against the committed file.
- **The scans are served straight from `data/images`.** Vite's `publicDir`
  points at that directory, so a card's image URL is `/<setId>/<file>` in both
  the dev server and the build, and nothing is copied into the repo twice.

The symbols that appear inline in card text render as coloured text badges. The
printed glyphs are not available as artwork yet.

## Card data and images

Both text and scans are reproduced here to preserve a game that has been out of print for over twenty
years and is not sold by anyone today. This is archival intent, not a claim that the underlying
work is free of copyright. The publisher no longer exists.

The MIT license in `LICENSE` covers the source code only.

If you hold rights to this material and want it removed, please open an issue or contact me via email: `dev.neil.cochran@pm.me`.
