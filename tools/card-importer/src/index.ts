/**
 * Builds `packages/cards/generated/cards.json` from the committed sources in
 * `data/`.
 *
 * The importer is strict. Anything it cannot explain is an error, not a
 * warning, because the card pool is fixed at 617 printings of 616 cards and
 * every surprise so far has turned out to be a real defect in the source data.
 * Everything comes from one corrected source file, `data/cards.csv`, so a
 * rebuild is a pure parse with nothing to patch at build time.
 *
 * Run with `--check` to verify the committed output matches a fresh run
 * without writing anything.
 */

import { readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';

import {
  ALLEGIANCES,
  ATTRIBUTES,
  CARD_SETS,
  CARD_TYPES,
  RARITY_CODES,
  TOTAL_CARD_COUNT,
  TOTAL_PRINTING_COUNT,
  findUnknownSymbolTokens,
  toCardRarity,
} from '../../../packages/cards/src/index.ts';
import type {
  AbilityRating,
  AbilityTrack,
  Allegiance,
  Attribute,
  Card,
  CardDatabase,
  CardPrinting,
  CardSet,
  CardSetId,
  CardType,
  RarityClass,
  RarityCode,
} from '../../../packages/cards/src/index.ts';

import { parseCsv } from './csv.ts';
import type { CsvRow } from './csv.ts';

/** Repository root, resolved from this file's location. */
const REPO_ROOT = join(import.meta.dirname, '..', '..', '..');

/** Where the committed source data lives. */
const DATA_DIR = join(REPO_ROOT, 'data');

/** Where the generated database is written. */
const OUTPUT_PATH = join(REPO_ROOT, 'packages', 'cards', 'generated', 'cards.json');

/** A source row that is really another printing of a card listed elsewhere. */
interface MergedPrinting {
  /** Id of the card this row is a printing of. */
  readonly into: string;
  /** The name exactly as it appears on this printing. */
  readonly name: string;
  /** What distinguishes this printing from the canonical one. */
  readonly note: string;
}

/** Every card carries an artist credit. */
const EXPECTED_ARTIST_COUNT = TOTAL_CARD_COUNT;

/** Source CSV column names, paired with the ability track they belong to. */
const ABILITY_COLUMNS: ReadonlyArray<readonly [AbilityTrack, string]> = [
  ['politics', 'politics'],
  ['intrigue', 'intrigue'],
  ['onePower', 'one_power'],
  ['combat', 'combat'],
];

/** Collected failures, reported together so one run surfaces every problem. */
const errors: string[] = [];

/**
 * Record a failure against a specific card or file.
 *
 * @param where - Which card or file the problem is in.
 * @param message - What is wrong.
 */
function fail(where: string, message: string): void {
  errors.push(`${where}: ${message}`);
}

/**
 * Reduce a card name to the form used in image filenames.
 *
 * @param name - The card name as printed.
 * @returns The name lower-cased, without apostrophes, with spaces as underscores.
 */
function toSlug(name: string): string {
  return name.toLowerCase().replaceAll("'", '').replaceAll(' ', '_');
}

/** Fields that identify a printing rather than the card it is a printing of. */
const PRINTING_FIELDS: ReadonlySet<string> = new Set([
  'id',
  'name',
  'image',
  'thumbnail',
  'otherPrintings',
]);

/**
 * Fold rows that are alternative printings into the cards they belong to.
 *
 * Two rows only merge if they agree on everything the rules care about. If they
 * differ anywhere else, they are not the same card and the merge is refused,
 * because silently dropping a real card would be much worse than a build error.
 *
 * @param cards - Every imported row, in order.
 * @param merges - Declared printing merges, keyed by the id being folded away.
 * @returns The cards with merged rows removed and recorded as other printings.
 */
function mergePrintings(
  cards: readonly Card[],
  merges: Readonly<Record<string, MergedPrinting>>,
): Card[] {
  const byId = new Map(cards.map((card) => [card.id, card]));
  const merged = new Map<string, CardPrinting[]>();

  for (const [id, entry] of Object.entries(merges)) {
    const source = byId.get(id);
    const target = byId.get(entry.into);
    if (source === undefined) {
      fail('printings', `mergedPrintings names ${id}, which is not an imported card`);
      continue;
    }
    if (target === undefined) {
      fail('printings', `mergedPrintings.${id}.into names ${entry.into}, which does not exist`);
      continue;
    }
    const differing = Object.keys({ ...source, ...target })
      .filter((field) => !PRINTING_FIELDS.has(field))
      .filter((field) => {
        const a: unknown = Reflect.get(source, field);
        const b: unknown = Reflect.get(target, field);
        return JSON.stringify(a) !== JSON.stringify(b);
      });
    if (differing.length > 0) {
      fail(
        id,
        `cannot merge into ${entry.into}: they differ on ${differing.join(', ')}, ` +
          `so they are not the same card`,
      );
      continue;
    }
    const printings = merged.get(entry.into) ?? [];
    printings.push({
      name: entry.name,
      image: source.image,
      thumbnail: source.thumbnail,
      note: entry.note,
    });
    merged.set(entry.into, printings);
  }

  return cards
    .filter((card) => merges[card.id] === undefined)
    .map((card) => {
      const printings = merged.get(card.id);
      return printings === undefined ? card : { ...card, otherPrintings: printings };
    });
}

/**
 * List the image filename stems present on disk for a set.
 *
 * Each card has a full-size scan and an `_SM` thumbnail sharing a stem, so both
 * collapse to one entry here. Any stem left unclaimed once every card is
 * imported is reported as an orphan.
 *
 * @param set - The set being imported.
 * @returns The distinct filename stems found in the set's image directory.
 */
function listImageStems(set: CardSet): Set<string> {
  const stems = new Set<string>();
  for (const file of readdirSync(join(DATA_DIR, 'images', set.id))) {
    if (file.endsWith('_SM.jpg')) {
      stems.add(file.slice(0, -'_SM.jpg'.length));
    } else if (file.endsWith('.jpg')) {
      stems.add(file.slice(0, -'.jpg'.length));
    } else {
      fail(set.id, `unexpected non-image file ${file}`);
    }
  }
  return stems;
}

/**
 * Split a comma-separated source field into trimmed values.
 *
 * The source splits these on commas without trimming, and an empty field
 * splits into a single empty value, so both are handled here.
 *
 * @param raw - The raw field content.
 * @returns The values, trimmed, with empties removed.
 */
function splitList(raw: string): string[] {
  return raw
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value !== '');
}

/**
 * Read one ability track's rating and cost.
 *
 * Blank cells become absent fields rather than zero. The source data contains
 * no explicit zeroes, so a blank means the card has no rating in that track.
 *
 * @param row - The source row.
 * @param column - The column prefix, for example `One Power`.
 * @param where - Card identifier used in error messages.
 * @returns The rating, with fields omitted where the source is blank.
 */
function readAbility(row: CsvRow, column: string, where: string): AbilityRating {
  function readCell(suffix: string): number | undefined {
    const raw = (row[`${column}_${suffix}`] ?? '').trim();
    if (raw === '') {
      return undefined;
    }
    if (!/^\d+$/.test(raw)) {
      fail(where, `${column}_${suffix} is not a number: ${JSON.stringify(raw)}`);
      return undefined;
    }
    const value = Number.parseInt(raw, 10);
    if (value === 0) {
      fail(where, `${column}_${suffix} is an explicit zero, which the source data never uses`);
    }
    return value;
  }

  const ability = readCell('ability');
  const cost = readCell('cost');
  return {
    ...(ability === undefined ? {} : { ability }),
    ...(cost === undefined ? {} : { cost }),
  };
}

/**
 * Build a card's id from its set, collector number and name.
 *
 * The name is included because collector number alone is not unique: Dark
 * Prophecies prints two cards numbered 54. The result is also the stem of the
 * card's image filenames, which the importer verifies exist.
 *
 * @param set - The set being imported.
 * @param collectorNumber - The number printed on the card.
 * @param name - The card name as printed.
 * @returns The card id.
 */
function buildId(set: CardSet, collectorNumber: number, name: string): string {
  return `0${set.number}-${String(collectorNumber).padStart(3, '0')}_${toSlug(name)}`;
}

/**
 * Convert one source row into a card.
 *
 * @param row - The source row.
 * @param set - The set the row belongs to.
 * @returns The card, or `undefined` if the row could not be converted.
 */
function toCard(row: CsvRow, set: CardSet): Card | undefined {
  const name = (row['name'] ?? '').trim();
  if (name === '') {
    return undefined;
  }

  const rawNumber = (row['number'] ?? '').trim();
  if (!/^\d+$/.test(rawNumber)) {
    fail(`${set.id} ${name}`, `collector number is not a number: ${JSON.stringify(rawNumber)}`);
    return undefined;
  }
  const collectorNumber = Number.parseInt(rawNumber, 10);
  const id = buildId(set, collectorNumber, name);

  const rawType = (row['type'] ?? '').trim();
  const type: CardType | undefined = CARD_TYPES.find((value) => value === rawType);
  if (type === undefined) {
    fail(id, `unknown card type ${JSON.stringify(rawType)}`);
  }

  const rawRarity = (row['rarity'] ?? '').trim();
  const rarityCode: RarityCode | undefined = RARITY_CODES.find((value) => value === rawRarity);
  if (rarityCode === undefined) {
    fail(id, `unknown rarity ${JSON.stringify(rawRarity)}`);
  }

  const allegiances: Allegiance[] = [];
  for (const value of splitList(row['allegiances'] ?? '')) {
    const match = ALLEGIANCES.find((known) => known === value);
    if (match === undefined) {
      fail(id, `unknown allegiance ${JSON.stringify(value)}`);
      continue;
    }
    allegiances.push(match);
  }

  const attributes: Attribute[] = [];
  for (const value of splitList(row['attributes'] ?? '')) {
    const match = ATTRIBUTES.find((known) => known === value);
    if (match === undefined) {
      fail(id, `unknown attribute ${JSON.stringify(value)}`);
      continue;
    }
    attributes.push(match);
  }

  const effect = (row['effect'] ?? '').trim();
  const lore = (row['lore'] ?? '').trim();
  for (const [label, text] of [
    ['effect', effect],
    ['lore', lore],
  ] as const) {
    for (const token of findUnknownSymbolTokens(text)) {
      fail(id, `unrecognised symbol token in ${label}: ${token}`);
    }
  }

  const abilities: Record<AbilityTrack, AbilityRating> = {
    politics: {},
    intrigue: {},
    onePower: {},
    combat: {},
  };
  for (const [track, column] of ABILITY_COLUMNS) {
    abilities[track] = readAbility(row, column, id);
  }

  const artist = (row['artist'] ?? '').trim();

  if (type === undefined || rarityCode === undefined) {
    return undefined;
  }

  return {
    id,
    setId: set.id,
    collectorNumber,
    name,
    type,
    rarity: toCardRarity(rarityCode),
    allegiances,
    attributes,
    ...(artist === '' ? {} : { artist }),
    ...(effect === '' ? {} : { effect }),
    ...(lore === '' ? {} : { lore }),
    abilities,
    image: `${id}.jpg`,
    thumbnail: `${id}_SM.jpg`,
  };
}

/** Slots on each set's print sheets, by set id and rarity class. */
const PRINT_SHEETS: ReadonlyArray<readonly [CardSetId, RarityClass, number]> = [
  ['premiere', 'Rare', 100],
  ['premiere', 'Uncommon', 150],
  ['premiere', 'Common', 150],
  ['dark_prophecies', 'Rare', 100],
  ['dark_prophecies', 'Uncommon', 100],
  ['dark_prophecies', 'Common', 100],
  ['children_of_the_dragon', 'Rare', 100],
  ['children_of_the_dragon', 'Uncommon', 100],
  ['children_of_the_dragon', 'Common', 100],
];

/**
 * Whether a card was collated onto a given class's print sheet.
 *
 * Fixed/Common cards came in starter decks and in boosters as commons, so they
 * sit on the common sheet.
 *
 * @param card - The card to place.
 * @param rarityClass - The sheet being filled.
 * @returns Whether the card belongs on that sheet.
 */
function onPrintSheet(card: Card, rarityClass: RarityClass): boolean {
  if (rarityClass === 'Common') {
    return card.rarity.class === 'Common' || card.rarity.code === 'F/C';
  }
  return card.rarity.class === rarityClass;
}

/**
 * Check that each set's printings fill its print sheets exactly.
 *
 * A card takes as many slots as its sheet frequency, once per printing.
 *
 * @param printings - Every imported row, before printings are merged.
 */
function checkPrintSheets(printings: readonly Card[]): void {
  for (const [setId, rarityClass, expected] of PRINT_SHEETS) {
    const slots = printings
      .filter((card) => card.setId === setId && onPrintSheet(card, rarityClass))
      .reduce((total, card) => total + (card.rarity.sheetFrequency ?? 0), 0);
    if (slots !== expected) {
      fail(setId, `${rarityClass} print sheet holds ${slots} slots, expected ${expected}`);
    }
  }
}

/**
 * Import every set.
 *
 * @returns The generated database.
 */
function importAll(): CardDatabase {
  const rows = parseCsv(readFileSync(join(DATA_DIR, 'cards.csv'), 'utf8'));
  const bySet = new Map<string, CsvRow[]>();
  for (const row of rows) {
    const setId = (row['set'] ?? '').trim();
    const set = CARD_SETS.find((candidate) => candidate.id === setId);
    if (set === undefined) {
      fail('cards.csv', `unknown set ${JSON.stringify(setId)}`);
      continue;
    }
    bySet.set(setId, [...(bySet.get(setId) ?? []), row]);
  }

  const cards: Card[] = [];
  const merges: Record<string, MergedPrinting> = {};
  for (const set of CARD_SETS) {
    const stems = listImageStems(set);
    const setCards: Card[] = [];
    for (const row of bySet.get(set.id) ?? []) {
      const card = toCard(row, set);
      if (card === undefined) {
        continue;
      }
      setCards.push(card);
      const into = (row['printing_of'] ?? '').trim();
      if (into !== '') {
        merges[card.id] = {
          into,
          name: card.name,
          note: (row['printing_note'] ?? '').trim(),
        };
      }
    }
    if (setCards.length !== set.printingCount) {
      fail(set.id, `expected ${set.printingCount} printings, imported ${setCards.length}`);
    }
    const usedIds = new Set(setCards.map((card) => card.id));
    for (const stem of stems) {
      if (!usedIds.has(stem)) {
        fail(set.id, `image ${stem}.jpg has no matching card`);
      }
    }
    setCards.sort((a, b) => a.collectorNumber - b.collectorNumber || a.id.localeCompare(b.id));
    cards.push(...setCards);
  }

  const seen = new Set<string>();
  for (const card of cards) {
    if (seen.has(card.id)) {
      fail(card.id, 'duplicate card id');
    }
    seen.add(card.id);
  }

  if (cards.length !== TOTAL_PRINTING_COUNT) {
    fail('total', `expected ${TOTAL_PRINTING_COUNT} printings, imported ${cards.length}`);
  }

  for (const card of cards) {
    for (const file of [card.image, card.thumbnail]) {
      if (!existsSync(join(DATA_DIR, 'images', card.setId, file))) {
        fail(card.id, `missing image file ${file}`);
      }
    }
  }

  const distinct = mergePrintings(cards, merges);

  if (distinct.length !== TOTAL_CARD_COUNT) {
    fail('total', `expected ${TOTAL_CARD_COUNT} distinct cards, got ${distinct.length}`);
  }

  const credited = distinct.filter((card) => card.artist !== undefined).length;
  if (credited !== EXPECTED_ARTIST_COUNT) {
    fail('total', `expected ${EXPECTED_ARTIST_COUNT} cards with an artist, got ${credited}`);
  }

  checkPrintSheets(cards);

  return { sets: CARD_SETS, cards: distinct };
}

/**
 * Run the importer.
 *
 * @returns The process exit code.
 */
function main(): number {
  const check = process.argv.includes('--check');
  const database = importAll();

  if (errors.length > 0) {
    console.error(`Card import failed with ${errors.length} problem(s):`);
    for (const error of errors) {
      console.error(`  ${error}`);
    }
    return 1;
  }

  const serialised = `${JSON.stringify(database, undefined, 2)}\n`;

  if (check) {
    if (!existsSync(OUTPUT_PATH)) {
      console.error(`Card import check failed: ${OUTPUT_PATH} does not exist.`);
      return 1;
    }
    if (readFileSync(OUTPUT_PATH, 'utf8') !== serialised) {
      console.error('Card import check failed: generated output differs from the committed file.');
      return 1;
    }
    console.log(
      `Card import check passed: ${database.cards.length} cards match the committed file.`,
    );
    return 0;
  }

  mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
  writeFileSync(OUTPUT_PATH, serialised);
  const printings = database.cards.reduce(
    (total, card) => total + 1 + (card.otherPrintings?.length ?? 0),
    0,
  );
  console.log(
    `Imported ${database.cards.length} cards ` +
      `(${printings} printings) across ${database.sets.length} sets.`,
  );
  for (const set of database.sets) {
    const count = database.cards.filter((card) => card.setId === set.id).length;
    console.log(`  ${set.name}: ${count}`);
  }
  return 0;
}

process.exit(main());
