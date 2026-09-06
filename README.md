# Wheel of Time CCG

A web implementation of the Wheel of Time Collectible Card Game, published by
Precedence Entertainment in 1999 and out of print since the company closed in
2002.

The project runs locally. There is no hosted instance and no account system.

## Getting set up

Requires Node 24 or newer and pnpm.

```
pnpm install
pnpm typecheck
```

Nothing is compiled. Node 24 strips types from the `.ts` sources directly, and
TypeScript only ever type-checks, which is why imports carry `.ts` extensions.

## Building the card data

The importer itself has no dependencies and runs on bare Node.

```
pnpm import-cards
```

It validates as it goes and fails on any surprise: an unknown card type,
rarity, allegiance, attribute or inline symbol; an ability rating of zero, which
the source data never uses; a card with no image, or an image with no card; a
duplicate card id; or a total that is not exactly 617 printings of 616 cards.

A rebuild is a pure parse of a single file. `data/cards.csv` holds everything: card text, artist credits, and the one relationship
between rows that the publisher's own catalogue created.

Two columns are blank for all but one row. `printing_of` names the card a row is
another printing of, and `printing_note` says what distinguishes it.

The two totals differ because Dark Prophecies printed one card twice. Its name
was misprinted as "Jarette Byar", corrected to "Jaret Byar" in a later run, and
Precedence catalogued both under collector number 54. They are one card, so the
importer folds the misprint into `otherPrintings` rather than leaving two rows
that a deck builder would happily let you play six copies of.

## Card data and images

The card text was transcribed by hobbyists from the printed cards; the scans
were made from the same product. Both are reproduced here to preserve a game
that has been out of print for over twenty years and is not sold by anyone
today. This is archival intent, not a claim that the underlying work is free of
copyright. The publisher no longer exists.

The MIT license in `LICENSE` covers the source code only.

If you hold rights to this material and want it removed, please open an issue or contact me via email: `dev.neil.cochran@pm.me`.
