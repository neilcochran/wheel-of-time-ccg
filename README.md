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

## Checks

```
pnpm check
```

Runs the type checker, ESLint, the Prettier check, the tests, the card import
check, and the production build, in that order. CI runs the same six as
separate steps. Each is also available on its own:

| Command             | What it does                                                     |
| ------------------- | ---------------------------------------------------------------- |
| `pnpm typecheck`    | `tsc --noEmit` over the Node surfaces, then over the browser app |
| `pnpm lint`         | ESLint, warnings treated as failures                             |
| `pnpm lint:fix`     | The same, applying every autofix                                 |
| `pnpm format`       | Prettier, writing in place                                       |
| `pnpm format:check` | Prettier, failing instead of writing                             |
| `pnpm test`         | Vitest, single run, both projects                                |
| `pnpm build`        | Vite production build of the browser app into `apps/web/dist`    |
| `pnpm dev`          | Vite dev server for the browser app                              |

The type check runs twice because the Node surfaces and the browser app need
different `lib` settings: the packages and tools must not see the DOM, and the
app must. Vitest is split into two projects for the same reason, `node` for the
packages and tools and `web` for the app, which runs under jsdom.

ESLint enforces more than the usual defaults: exported functions need explicit
return types, type-only imports must be separate `import type` statements
because `verbatimModuleSyntax` is on, and `as` and `!` are rejected outside of
`as const`. Formatting rules live entirely in Prettier; ESLint does not
duplicate them.

Two supply-chain settings live in `pnpm-workspace.yaml`. `allowBuilds` denies
every dependency build script unless it is named there and reviewed, so a
compromised transitive package cannot fire a postinstall hook.
`minimumReleaseAge` refuses any version published in the last seven days,
matching the Dependabot cooldown, so a malicious publish has time to be caught
and yanked before anything here installs it.

That second one has a consequence worth knowing before it bites: a dependency
floor in `package.json` cannot name a release younger than the window, because
nothing would satisfy it. Bump floors to a version that is already a week old.

The same rule applies to pnpm itself. `packageManager` pins a release that is
already older than the window, so the pin is installable under a seven-day
cooldown rather than only through corepack, which does not enforce one. The
`+sha512` suffix on that pin is corepack's integrity check on the downloaded
binary; keep it when bumping the version.

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

The card text was transcribed by hobbyists from the printed cards, then
checked against these scans, which were made from the same product, and
corrected wherever the two disagreed. The rules and flavour text match the
printed cards, misprints included. The one thing normalised is the notation
for the ability symbols printed on the cards, which the transcribers spelled
forty-three different ways: each is now the symbol name in square brackets,
repeated once per printed glyph. Both text and scans are reproduced here to
preserve a game that has been out of print for over twenty years and is not
sold by anyone today. This is archival intent, not a claim that the underlying
work is free of copyright. The publisher no longer exists.

The MIT license in `LICENSE` covers the source code only.

If you hold rights to this material and want it removed, please open an issue or contact me via email: `dev.neil.cochran@pm.me`.
