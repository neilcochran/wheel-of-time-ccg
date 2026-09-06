# Wheel of Time CCG

A web implementation of the Wheel of Time Collectible Card Game, published by
Precedence Entertainment in 1999 and out of print since the company closed in 2002.

The project runs locally. There is no hosted instance and no account system.

## Getting set up

Requires Node 24 or newer. The pnpm version is pinned by the `packageManager`
field, so `corepack pnpm install` fetches the right one on its own.

```
pnpm install
pnpm typecheck
```

Nothing is compiled. Node 24 strips types from the `.ts` sources directly, and
TypeScript only ever type-checks, which is why imports carry `.ts` extensions.

## Checks

```
pnpm check
```

Runs the type checker, ESLint, the Prettier check, the tests, and the card
import check, in that order. CI runs the same five as separate steps. Each is
also available on its own:

| Command             | What it does                               |
| ------------------- | ------------------------------------------ |
| `pnpm typecheck`    | `tsc --noEmit` over every package and tool |
| `pnpm lint`         | ESLint, warnings treated as failures       |
| `pnpm lint:fix`     | The same, applying every autofix           |
| `pnpm format`       | Prettier, writing in place                 |
| `pnpm format:check` | Prettier, failing instead of writing       |
| `pnpm test`         | Vitest, single run                         |

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
