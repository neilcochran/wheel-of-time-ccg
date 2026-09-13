/**
 * Card model for the Wheel of Time CCG.
 *
 * Each vocabulary is a runtime array with its type derived from that array, so
 * the importer validates against exactly the values the type permits. The
 * vocabularies are closed: a value outside them is a data error.
 */

/** The five published card sets, in set-number order. */
export const CARD_SET_IDS = [
  'promo',
  'premiere',
  'dark_prophecies',
  'children_of_the_dragon',
  'cycles',
] as const;

/** Stable identifier for one of the five published card sets. */
export type CardSetId = (typeof CARD_SET_IDS)[number];

/** A published card set. */
export interface CardSet {
  /** Stable identifier, also the directory name under `data/images`. */
  readonly id: CardSetId;
  /** Set number used as the first component of every card id in the set. */
  readonly number: number;
  /** Name as printed on the product. */
  readonly name: string;
  /**
   * Number of distinct pieces of cardboard in the set, which is what the
   * official rarity lists and every collector checklist count.
   *
   * This is not always the number of distinct cards. Dark Prophecies counts
   * 151 because Precedence catalogued the misprinted `Jarette Byar` and its
   * corrected reprint separately, but they are one card. See
   * {@link Card.otherPrintings}.
   */
  readonly printingCount: number;
}

/** The five card types. Every card has exactly one. */
export const CARD_TYPES = ['Advantage', 'Challenge', 'Character', 'Event', 'Troop'] as const;

/** The type printed on a card. */
export type CardType = (typeof CARD_TYPES)[number];

/** Rarity codes as encoded in the source CSVs. */
export const RARITY_CODES = ['C', 'U', 'U1', 'R', 'R1', 'R2', 'R3', 'F', 'F/C', 'P'] as const;

/**
 * Rarity exactly as encoded in the source data.
 *
 * A code carries both a rarity class and, for the numbered codes, a print sheet
 * frequency. {@link CardRarity} splits the two apart.
 */
export type RarityCode = (typeof RARITY_CODES)[number];

/** Rarity classes as the official per-set rarity lists name them. */
export const RARITY_CLASSES = [
  'Common',
  'Uncommon',
  'Rare',
  'Fixed',
  'Fixed/Common',
  'Promo',
] as const;

/**
 * Rarity as the official per-set rarity lists describe it, and as a collector
 * would say it out loud. This is the value to show in the UI.
 */
export type RarityClass = (typeof RARITY_CLASSES)[number];

/** How a card was distributed. */
export interface CardRarity {
  /** The code as it appears in the source data. */
  readonly code: RarityCode;
  /** The rarity class. Use {@link formatRarity} to render it. */
  readonly class: RarityClass;
  /**
   * How many times the card appears on its print sheet.
   *
   * Fewer appearances means harder to pull, so this orders scarcity within a
   * class: an `R1` at 1 is a chase rare, an `R3` at 3 is the easiest rare to
   * find. Absent for `F` and `P`, which came from starter decks and promotions
   * rather than booster packs.
   */
  readonly sheetFrequency?: number;
}

/**
 * Allegiances, printed after the type on characters and troops.
 *
 * A card with additional allegiances prints them in bold alongside its traits,
 * or grants them in its rules text. The rules treat these exactly like the
 * allegiance after the type, so they are allegiances here, not traits.
 *
 * An allegiance determines which faction a card belongs to, and therefore what
 * can recruit it. A card may have several, or none.
 *
 * `Precedence` belongs to a single promo card that names the publisher as its
 * faction.
 */
export const ALLEGIANCES = [
  'Aes Sedai',
  'Aiel',
  'Andor',
  'Cairhien',
  'Children of the Light',
  'Dark One',
  'Dragon',
  'Illian',
  'Mercenary',
  'Precedence',
  'Tear',
] as const;

/** A faction a card belongs to. */
export type Allegiance = (typeof ALLEGIANCES)[number];

/**
 * Sub-types, printed after the type in the same place an allegiance would be.
 *
 * A sub-type narrows what a card acts on. `Character`, `Player`, `Troop` and
 * `World` say what an advantage targets; `Limited` marks an event that may only
 * be played during the Take Actions step. No other type carries one, and an
 * advantage that can target either a character or a troop carries none.
 */
export const CARD_SUBTYPES = ['Character', 'Limited', 'Player', 'Troop', 'World'] as const;

/** A sub-type narrowing what a card acts on. */
export type CardSubtype = (typeof CARD_SUBTYPES)[number];

/** The sub-types each card type may carry. Types absent here carry none. */
export const SUBTYPES_BY_CARD_TYPE: Readonly<Partial<Record<CardType, readonly CardSubtype[]>>> = {
  Advantage: ['Character', 'Player', 'Troop', 'World'],
  Event: ['Limited'],
};

/**
 * Traits, printed in bold above a card's rules text.
 *
 * Traits are referenced by other cards' rules text, so the rules engine will
 * match on these values directly. That is why they are a closed union and not
 * free-form strings.
 *
 * An allegiance printed in the bold trait line is not listed here; it is one of
 * the {@link ALLEGIANCES}.
 */
export const TRAITS = [
  'Accepted',
  'Band of the Red Hand',
  'Black Ajah',
  'Black Eyes',
  'Blue Ajah',
  'Bonded to Birgitte',
  'Bonded to Elayne Trakand',
  'Bonded to Ihvon',
  'Bonded to Lan Mandragoran',
  'Bonded to Moiraine Sedai',
  'Bonded to Owein',
  'Borderland',
  'Brown Ajah',
  'Capital of Andor',
  'Capital of Cairhien',
  'Capital of Illian',
  "Car'a'carn",
  'Chareen Aiel',
  'Clan Chief of the Chareen Aiel',
  'Clan Chief of the Codarra Aiel',
  'Clan Chief of the Daryne Aiel',
  'Clan Chief of the Goshien Aiel',
  'Clan Chief of the Miagoma Aiel',
  'Clan Chief of the Nakai Aiel',
  'Clan Chief of the Reyn Aiel',
  'Clan Chief of the Shaarad Aiel',
  'Clan Chief of the Shiande Aiel',
  'Clan Chief of the Taardad Aiel',
  'Clan Chief of the Tomanelle Aiel',
  'Contested Advantage',
  'Council of Nine',
  'Dark Nature',
  'Daughter-Heir',
  'Dragon Reborn',
  'Dreamwalker',
  'First Captain of the Companions',
  'First of Mayene',
  'Forsaken',
  'Gleeman',
  'Goshien Aiel',
  'Green Ajah',
  'Hero of the Horn',
  'High Inquisitor',
  'Hunter of the Horn',
  'Illuminator',
  'Inquisitor',
  'Keeper of the Chronicles',
  'King of Cairhien',
  'King of Illian',
  'Light Nature',
  'Lord Captain',
  'Lord Captain Commander',
  'Maiden of the Spear',
  'Malkier',
  'Miagoma Aiel',
  'Monster',
  'Multiple',
  'Myrddraal',
  'Nakai Aiel',
  'Nation Contested Advantage',
  'Novice',
  'Ogier',
  'Peddler',
  'Prophecy',
  'Queen of Andor',
  'Red Ajah',
  'Red Shield',
  'Reinforcement',
  'Repeatable',
  'Reyn Aiel',
  'Roofmistress of Cold Rocks Hold',
  'Roofmistress of Comarda Hold',
  'Saldaean',
  'Shaarad Aiel',
  'Shaido Aiel',
  'Shiande Aiel',
  'Spymaster',
  'Starting Advantage',
  'Starting Hero',
  'Starting Villain',
  'Stone Dog',
  "Ta'veren",
  'Taardad Aiel',
  'Terrain',
  'The Amyrlin Seat',
  'Thief-catcher',
  'Tomanelle Aiel',
  'Treesinger',
  'Trolloc',
  'Two Rivers',
  'Unique',
  'Warder',
  'Weapon',
  'Wise One',
  'Wolf',
  'Wolfbrother',
  'Yellow Ajah',
] as const;

/** A trait printed on a card. */
export type Trait = (typeof TRAITS)[number];

/** The four ability tracks, in the order the cards print them. */
export const ABILITY_TRACKS = ['politics', 'intrigue', 'onePower', 'combat'] as const;

/** One of the four abilities a card can roll and pay with. */
export type AbilityTrack = (typeof ABILITY_TRACKS)[number];

/**
 * The colour each ability track is printed in, and the colour of its die.
 *
 * From the rulebook: "Characters can have abilities in Politics (green),
 * Intrigue (blue), the One Power (white) and Combat (black)."
 */
export const ABILITY_TRACK_COLOURS: Readonly<Record<AbilityTrack, string>> = {
  politics: 'green',
  intrigue: 'blue',
  onePower: 'white',
  combat: 'black',
};

/**
 * A card's rating in one ability track.
 *
 * A field is absent rather than zero when the card has no rating in that track.
 * The data holds no zeroes, so a zero here is an import bug.
 */
export interface AbilityRating {
  /** Dice the card rolls in this track. Absent if it has no rating. */
  readonly ability?: number;
  /** Cost to recruit the card using this track. Absent if it cannot be recruited this way. */
  readonly cost?: number;
}

/**
 * An alternative printing of a card.
 *
 * The same card, printed differently. Everything that matters to the rules is
 * identical, so a printing is never a separate card: three copies of a card is
 * three copies however they were printed.
 */
export interface CardPrinting {
  /** The name exactly as it appears on this printing. */
  readonly name: string;
  /** Full-size scan filename, relative to `data/images/<setId>/`. */
  readonly image: string;
  /** Thumbnail filename, relative to `data/images/<setId>/`. */
  readonly thumbnail: string;
  /** What distinguishes this printing from the canonical one. */
  readonly note: string;
}

/** A single card. */
export interface Card {
  /**
   * Unique identifier, formed from the set number, the collector number and
   * the card name, for example `01-016_asmodean_(i)`. It is also the stem of
   * the card's image filenames.
   *
   * The name is part of the id because collector number alone is not unique:
   * Dark Prophecies prints two cards numbered 54, `02-054_jaret_byar` and
   * `02-054_jarette_byar_(misprint)`.
   */
  readonly id: string;
  /** The set this card belongs to. */
  readonly setId: CardSetId;
  /** Number printed on the card, unique within its set except for misprint variants. */
  readonly collectorNumber: number;
  /** Name printed on the card. */
  readonly name: string;
  /** The card's type. */
  readonly type: CardType;
  /** What the card acts on, absent on the types that carry no sub-type. */
  readonly subtype?: CardSubtype;
  /** How the card was distributed. */
  readonly rarity: CardRarity;
  /** Factions the card belongs to. Empty when the card has none. */
  readonly allegiances: readonly Allegiance[];
  /** Traits printed on the card. Empty when the card has none. */
  readonly traits: readonly Trait[];
  /**
   * Credited artist, present on every card.
   *
   * A few cards credit two artists as a single "A and B" string.
   */
  readonly artist?: string;
  /** Rules text. Absent when the card has none. */
  readonly effect?: string;
  /** Flavour text. Absent when the card has none. */
  readonly lore?: string;
  /** Ability ratings, keyed by track. Every track is present; its fields may be absent. */
  readonly abilities: Readonly<Record<AbilityTrack, AbilityRating>>;
  /** Full-size scan filename of the canonical printing, relative to `data/images/<setId>/`. */
  readonly image: string;
  /** Thumbnail filename of the canonical printing, relative to `data/images/<setId>/`. */
  readonly thumbnail: string;
  /**
   * Other printings of this same card.
   *
   * Only printings the publisher catalogued separately appear here.
   */
  readonly otherPrintings?: readonly CardPrinting[];
}

/** The generated card database. */
export interface CardDatabase {
  /** The five published sets. */
  readonly sets: readonly CardSet[];
  /** Every card, ordered by set number then collector number. */
  readonly cards: readonly Card[];
}
