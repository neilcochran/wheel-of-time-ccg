/**
 * Manual changes: the tools players use to apply card text the engine does
 * not yet encode.
 *
 * They ignore the turn sequence, since card text can act at almost any
 * moment, but they still refuse changes that would leave the state
 * inconsistent, and every change is logged for both players.
 */

import type { ManualChange, ManualDestination } from './actions.ts';
import { controlProblem } from './cardRules.ts';
import type { DeckSide } from './deck/rules.ts';
import { shuffle } from './random.ts';
import { fail, ok } from './result.ts';
import type { Result } from './result.ts';
import type { CardLookup, GameState, PatternSection, ResourceSymbol } from './state.ts';
import {
  PLAYER_NAMES,
  SIDES,
  cardOf,
  changePattern,
  controllerOf,
  drawCards,
  findChallenge,
  forcesOf,
  hasDuplicates,
  locate,
  moveCard,
  takeId,
  updateChallenge,
  updateInstance,
  updatePlayer,
  withLog,
  withoutParticipation,
} from './stateOps.ts';
import type { PlayerZone } from './stateOps.ts';

/** Most symbols one manual change may add. */
const MAX_MANUAL_SYMBOLS = 20;

/** The change of one kind. */
type ChangeOf<K extends ManualChange['kind']> = Extract<ManualChange, { readonly kind: K }>;

/** How the log names each destination. */
const DESTINATION_NAMES: Readonly<Record<ManualDestination, string>> = {
  hand: 'hand',
  deckTop: 'the top of the deck',
  deckBottom: 'the bottom of the deck',
  discard: 'the discard pile',
  killed: 'the killed pile',
  removed: 'out of play',
  homeFront: 'the home front',
  battleground: 'the battleground',
};

/** The zone each destination is. */
const DESTINATION_ZONES: Readonly<Record<ManualDestination, PlayerZone>> = {
  hand: 'hand',
  deckTop: 'deck',
  deckBottom: 'deck',
  discard: 'discard',
  killed: 'killed',
  removed: 'removed',
  homeFront: 'homeFront',
  battleground: 'battleground',
};

/**
 * How the log names a section of the Pattern or the supply.
 *
 * @param section - The section.
 * @returns For example "the neutral section".
 */
function sectionName(section: PatternSection | 'supply'): string {
  switch (section) {
    case 'supply':
      return 'the supply';
    case 'neutral':
      return 'the neutral section';
    case 'hero':
      return "the Hero player's section";
    case 'villain':
      return "the Villain player's section";
  }
}

/**
 * Whether a value is a whole number other than zero.
 *
 * @param value - The value.
 * @returns True for non-zero integers.
 */
function isNonZeroInteger(value: number): boolean {
  return Number.isInteger(value) && value !== 0;
}

/**
 * Apply a manual change.
 *
 * @param state - The game.
 * @param side - The player making the change.
 * @param change - The change.
 * @param cards - The card database.
 * @returns The game, or why the change is refused.
 */
export function applyManualChange(
  state: GameState,
  side: DeckSide,
  change: ManualChange,
  cards: CardLookup,
): Result<GameState> {
  const by = `${PLAYER_NAMES[side]}, applying card text,`;
  switch (change.kind) {
    case 'damage':
      return changeDamage(state, change, cards, by);
    case 'pattern':
      return movePatternToken(state, change, by);
    case 'draw':
      return draw(state, side, change, cards, by);
    case 'moveCard':
      return moveCardByHand(state, change, cards, by);
    case 'attachAdvantage':
      return attachAdvantage(state, side, change, cards, by);
    case 'control':
      return changeControl(state, change, cards, by);
    case 'rotate':
      return rotate(state, change, cards, by);
    case 'ability':
      return changeAbility(state, change, cards, by);
    case 'challengeTotals':
      return changeChallengeTotals(state, change, by);
    case 'addSymbols':
      return addSymbols(state, side, change, by);
    case 'removeSymbols':
      return removeSymbols(state, side, change, by);
    case 'shuffleDeck':
      return shuffleDeck(state, side, by);
    case 'searchDeck':
      return searchDeck(state, side, change, cards, by);
    case 'handSize':
      return changeHandSize(state, side, change, by);
    case 'controlTokens':
      return changeControlTokens(state, change, cards, by);
    case 'replaceCharacter':
      return replaceCharacter(state, side, change, cards, by);
  }
}

/**
 * Add or remove damage.
 *
 * @param state - The game.
 * @param change - The change.
 * @param cards - The card database.
 * @param by - Who is making it, for the log.
 * @returns The game, or why not.
 */
function changeDamage(
  state: GameState,
  change: ChangeOf<'damage'>,
  cards: CardLookup,
  by: string,
): Result<GameState> {
  const instance = state.cards[change.instanceId];
  const card = cardOf(state, cards, change.instanceId);
  const inPlay = SIDES.some((side) => forcesOf(state, side).includes(change.instanceId));
  if (!inPlay || instance === undefined || card === undefined) {
    return fail('Choose a character or troop in play.');
  }
  if (!isNonZeroInteger(change.delta)) {
    return fail('Change damage by a whole number other than zero.');
  }
  if (instance.damage + change.delta < 0) {
    return fail(`${card.name} has only ${instance.damage} damage.`);
  }
  const next = updateInstance(state, change.instanceId, (current) => ({
    ...current,
    damage: current.damage + change.delta,
  }));
  const amount = Math.abs(change.delta);
  const text =
    change.delta > 0
      ? `${by} adds ${amount} damage to ${card.name}.`
      : `${by} removes ${amount} damage from ${card.name}.`;
  return ok(withLog(next, text));
}

/**
 * Move a Pattern token.
 *
 * @param state - The game.
 * @param change - The change.
 * @param by - Who is making it, for the log.
 * @returns The game, or why not.
 */
function movePatternToken(
  state: GameState,
  change: ChangeOf<'pattern'>,
  by: string,
): Result<GameState> {
  if (change.from === change.to) {
    return fail('Choose two different places.');
  }
  if (change.from !== 'supply' && state.pattern[change.from] === 0) {
    return fail(`There are no tokens on ${sectionName(change.from)}.`);
  }
  let next = change.from === 'supply' ? state : changePattern(state, change.from, -1);
  next = change.to === 'supply' ? next : changePattern(next, change.to, 1);
  return ok(
    withLog(
      next,
      `${by} moves a Pattern token from ${sectionName(change.from)} to ${sectionName(change.to)}.`,
    ),
  );
}

/**
 * Draw cards.
 *
 * @param state - The game.
 * @param side - The player drawing.
 * @param change - The change.
 * @param cards - The card database.
 * @param by - Who is making it, for the log.
 * @returns The game, or why not.
 */
function draw(
  state: GameState,
  side: DeckSide,
  change: ChangeOf<'draw'>,
  cards: CardLookup,
  by: string,
): Result<GameState> {
  if (!Number.isInteger(change.count) || change.count < 1) {
    return fail('Draw a whole number of cards, one or more.');
  }
  const drawn = drawCards(state, side, change.count);
  const count = drawn.drawn.length;
  let next = withLog(drawn.state, `${by} draws ${count} card${count === 1 ? '' : 's'}.`);
  if (count > 0) {
    const names = drawn.drawn.map((id) => cardOf(next, cards, id)?.name ?? id).join(', ');
    next = withLog(next, `You draw ${names}.`, side);
  }
  return ok(next);
}

/**
 * Move a card to a zone.
 *
 * @param state - The game.
 * @param change - The change.
 * @param cards - The card database.
 * @param by - Who is making it, for the log.
 * @returns The game, or why not.
 */
function moveCardByHand(
  state: GameState,
  change: ChangeOf<'moveCard'>,
  cards: CardLookup,
  by: string,
): Result<GameState> {
  const location = locate(state, change.instanceId);
  const instance = state.cards[change.instanceId];
  const card = cardOf(state, cards, change.instanceId);
  if (location === undefined || instance === undefined || card === undefined) {
    return fail('That card is not in the game.');
  }
  const isForce = card.type === 'Character' || card.type === 'Troop';
  const toPlay = change.to === 'homeFront' || change.to === 'battleground';
  if ((toPlay || change.to === 'killed') && !isForce) {
    return fail('Only characters and troops go to the home front, battleground or killed pile.');
  }
  const controller = controllerOf(state, change.instanceId);
  const side = toPlay ? (controller ?? instance.owner) : instance.owner;
  if (toPlay && controller === undefined) {
    const problem = controlProblem(side, card);
    if (problem !== undefined) {
      return fail(problem);
    }
  }
  const next = moveCard(
    state,
    change.instanceId,
    side,
    DESTINATION_ZONES[change.to],
    change.to === 'deckBottom',
  );
  const fromHidden =
    location.kind === 'faceDown' ||
    (location.kind === 'zone' && (location.zone === 'deck' || location.zone === 'hand'));
  const toHidden = change.to === 'hand' || change.to === 'deckTop' || change.to === 'deckBottom';
  const destination = DESTINATION_NAMES[change.to];
  if (fromHidden && toHidden) {
    return ok(
      withLog(
        withLog(next, `${by} moves a hidden card to ${destination}.`),
        `The hidden card is ${card.name}.`,
        instance.owner,
      ),
    );
  }
  return ok(withLog(next, `${by} moves ${card.name} to ${destination}.`));
}

/**
 * Put a card into play as an advantage.
 *
 * @param state - The game.
 * @param side - The player who will control it.
 * @param change - The change.
 * @param cards - The card database.
 * @param by - Who is making it, for the log.
 * @returns The game, or why not.
 */
function attachAdvantage(
  state: GameState,
  side: DeckSide,
  change: ChangeOf<'attachAdvantage'>,
  cards: CardLookup,
  by: string,
): Result<GameState> {
  const card = cardOf(state, cards, change.instanceId);
  if (card === undefined || locate(state, change.instanceId) === undefined) {
    return fail('That card is not in the game.');
  }
  if (controllerOf(state, change.instanceId) !== undefined) {
    return fail(`${card.name} is already in play.`);
  }
  const { target } = change;
  if (
    target.kind === 'card' &&
    !SIDES.some((candidate) => forcesOf(state, candidate).includes(target.instanceId))
  ) {
    return fail('An advantage on a card must go on a character or troop in play.');
  }
  let next = moveCard(state, change.instanceId, side, 'advantages');
  next = updateInstance(next, change.instanceId, (instance) => ({
    ...instance,
    attachedTo: target,
  }));
  const on =
    target.kind === 'card'
      ? ` on ${cardOf(state, cards, target.instanceId)?.name ?? 'a card'}`
      : target.kind === 'world'
        ? ' on the world'
        : ` on ${PLAYER_NAMES[target.side].replace('The', 'the')}`;
  return ok(withLog(next, `${by} puts ${card.name} into play as an advantage${on}.`));
}

/**
 * Give control of a card in play to a player.
 *
 * @param state - The game.
 * @param change - The change.
 * @param cards - The card database.
 * @param by - Who is making it, for the log.
 * @returns The game, or why not.
 */
function changeControl(
  state: GameState,
  change: ChangeOf<'control'>,
  cards: CardLookup,
  by: string,
): Result<GameState> {
  const location = locate(state, change.instanceId);
  const instance = state.cards[change.instanceId];
  const card = cardOf(state, cards, change.instanceId);
  const current = controllerOf(state, change.instanceId);
  if (
    location?.kind !== 'zone' ||
    current === undefined ||
    instance === undefined ||
    card === undefined
  ) {
    return fail('Choose a card in play.');
  }
  if (current === change.controller) {
    return fail(`${PLAYER_NAMES[current]} already controls ${card.name}.`);
  }
  const newController = PLAYER_NAMES[change.controller].replace('The', 'the');
  if (location.zone !== 'advantages') {
    const problem = controlProblem(change.controller, card);
    if (problem !== undefined) {
      return ok(
        withLog(
          moveCard(state, change.instanceId, instance.owner, 'discard'),
          `${by} gives ${card.name} to ${newController}, who cannot control it, so it is discarded.`,
        ),
      );
    }
  }
  const moved = moveCard(state, change.instanceId, change.controller, location.zone);
  const next = updateInstance(moved, change.instanceId, withoutParticipation);
  return ok(withLog(next, `${by} gives control of ${card.name} to ${newController}.`));
}

/**
 * Rotate or ready a card in play.
 *
 * @param state - The game.
 * @param change - The change.
 * @param cards - The card database.
 * @param by - Who is making it, for the log.
 * @returns The game, or why not.
 */
function rotate(
  state: GameState,
  change: ChangeOf<'rotate'>,
  cards: CardLookup,
  by: string,
): Result<GameState> {
  const card = cardOf(state, cards, change.instanceId);
  if (controllerOf(state, change.instanceId) === undefined || card === undefined) {
    return fail('Choose a card in play.');
  }
  const next = updateInstance(state, change.instanceId, (instance) => ({
    ...instance,
    rotated: change.rotated,
  }));
  return ok(withLog(next, `${by} ${change.rotated ? 'rotates' : 'readies'} ${card.name}.`));
}

/**
 * Raise or lower an ability.
 *
 * @param state - The game.
 * @param change - The change.
 * @param cards - The card database.
 * @param by - Who is making it, for the log.
 * @returns The game, or why not.
 */
function changeAbility(
  state: GameState,
  change: ChangeOf<'ability'>,
  cards: CardLookup,
  by: string,
): Result<GameState> {
  const card = cardOf(state, cards, change.instanceId);
  if (
    card === undefined ||
    !SIDES.some((side) => forcesOf(state, side).includes(change.instanceId))
  ) {
    return fail('Choose a character or troop in play.');
  }
  if (!isNonZeroInteger(change.delta)) {
    return fail('Change an ability by a whole number other than zero.');
  }
  const field = change.lasting ? 'lastingModifiers' : 'turnModifiers';
  const next = updateInstance(state, change.instanceId, (instance) => ({
    ...instance,
    [field]: { ...instance[field], [change.track]: instance[field][change.track] + change.delta },
  }));
  const amount = `${change.delta > 0 ? '+' : ''}${change.delta}`;
  const duration = change.lasting ? 'while it stays in play' : 'until the end of the turn';
  return ok(withLog(next, `${by} gives ${card.name} ${amount} ${change.track} ${duration}.`));
}

/**
 * Add to or take from a challenge's support and opposition.
 *
 * @param state - The game.
 * @param change - The change.
 * @param by - Who is making it, for the log.
 * @returns The game, or why not.
 */
function changeChallengeTotals(
  state: GameState,
  change: ChangeOf<'challengeTotals'>,
  by: string,
): Result<GameState> {
  const challenge = findChallenge(state, change.challengeId);
  if (challenge === undefined || challenge.outcome !== undefined) {
    return fail('Choose a challenge waiting to be resolved.');
  }
  if (!Number.isInteger(change.support) || !Number.isInteger(change.opposition)) {
    return fail('Change support and opposition by whole numbers.');
  }
  const support = challenge.support + change.support;
  const opposition = challenge.opposition + change.opposition;
  if (support < 0 || opposition < 0) {
    return fail('Support and opposition cannot go below zero.');
  }
  const next = updateChallenge(state, change.challengeId, (current) => ({
    ...current,
    support,
    opposition,
  }));
  return ok(
    withLog(next, `${by} sets the challenge to ${support} support and ${opposition} opposition.`),
  );
}

/**
 * Add symbols to a player's pool.
 *
 * @param state - The game.
 * @param side - The player.
 * @param change - The change.
 * @param by - Who is making it, for the log.
 * @returns The game, or why not.
 */
function addSymbols(
  state: GameState,
  side: DeckSide,
  change: ChangeOf<'addSymbols'>,
  by: string,
): Result<GameState> {
  if (!Number.isInteger(change.count) || change.count < 1 || change.count > MAX_MANUAL_SYMBOLS) {
    return fail(`Add between 1 and ${MAX_MANUAL_SYMBOLS} symbols.`);
  }
  let next = state;
  const symbols: ResourceSymbol[] = [];
  for (let index = 0; index < change.count; index += 1) {
    const taken = takeId(next, 'symbol-');
    next = taken.state;
    symbols.push({
      id: taken.id,
      track: change.track,
      source: { kind: 'manual', allegiances: change.allegiances },
    });
  }
  next = updatePlayer(next, side, (player) => ({ ...player, pool: [...player.pool, ...symbols] }));
  const allegiances =
    change.allegiances.length === 0 ? 'no allegiance' : change.allegiances.join(', ');
  return ok(
    withLog(next, `${by} adds ${change.count} ${change.track} symbols with ${allegiances}.`),
  );
}

/**
 * Take symbols out of a player's pool.
 *
 * @param state - The game.
 * @param side - The player.
 * @param change - The change.
 * @param by - Who is making it, for the log.
 * @returns The game, or why not.
 */
function removeSymbols(
  state: GameState,
  side: DeckSide,
  change: ChangeOf<'removeSymbols'>,
  by: string,
): Result<GameState> {
  const pool = state.players[side].pool;
  if (
    change.symbolIds.length === 0 ||
    hasDuplicates(change.symbolIds) ||
    !change.symbolIds.every((id) => pool.some((symbol) => symbol.id === id))
  ) {
    return fail('Choose symbols from your pool, each once.');
  }
  const next = updatePlayer(state, side, (player) => ({
    ...player,
    pool: player.pool.filter((symbol) => !change.symbolIds.includes(symbol.id)),
  }));
  return ok(withLog(next, `${by} removes ${change.symbolIds.length} symbols from their pool.`));
}

/**
 * Shuffle a player's deck.
 *
 * @param state - The game.
 * @param side - The player.
 * @param by - Who is making it, for the log.
 * @returns The game.
 */
function shuffleDeck(state: GameState, side: DeckSide, by: string): Result<GameState> {
  const shuffled = shuffle(state.random, state.players[side].deck);
  const next = updatePlayer({ ...state, random: shuffled.state }, side, (player) => ({
    ...player,
    deck: shuffled.value,
  }));
  return ok(withLog(next, `${by} shuffles their deck.`));
}

/**
 * Take a card from a player's deck into hand, then shuffle.
 *
 * @param state - The game.
 * @param side - The player.
 * @param change - The change.
 * @param cards - The card database.
 * @param by - Who is making it, for the log.
 * @returns The game, or why not.
 */
function searchDeck(
  state: GameState,
  side: DeckSide,
  change: ChangeOf<'searchDeck'>,
  cards: CardLookup,
  by: string,
): Result<GameState> {
  const found = state.players[side].deck.find((id) => state.cards[id]?.cardId === change.cardId);
  const card = cards.get(change.cardId);
  if (found === undefined || card === undefined) {
    return fail('That card is not in your deck.');
  }
  const moved = moveCard(state, found, side, 'hand');
  const shuffled = shuffle(moved.random, moved.players[side].deck);
  const next = updatePlayer({ ...moved, random: shuffled.state }, side, (player) => ({
    ...player,
    deck: shuffled.value,
  }));
  return ok(withLog(next, `${by} searches their deck for ${card.name} and shuffles it.`));
}

/**
 * Change a player's maximum hand size.
 *
 * @param state - The game.
 * @param side - The player.
 * @param change - The change.
 * @param by - Who is making it, for the log.
 * @returns The game, or why not.
 */
function changeHandSize(
  state: GameState,
  side: DeckSide,
  change: ChangeOf<'handSize'>,
  by: string,
): Result<GameState> {
  if (!isNonZeroInteger(change.delta)) {
    return fail('Change hand size by a whole number other than zero.');
  }
  const next = updatePlayer(state, side, (player) => ({
    ...player,
    handSizeModifier: player.handSizeModifier + change.delta,
  }));
  return ok(withLog(next, `${by} changes their maximum hand size by ${change.delta}.`));
}

/**
 * Add or remove control tokens on a contested advantage.
 *
 * @param state - The game.
 * @param change - The change.
 * @param cards - The card database.
 * @param by - Who is making it, for the log.
 * @returns The game, or why not.
 */
function changeControlTokens(
  state: GameState,
  change: ChangeOf<'controlTokens'>,
  cards: CardLookup,
  by: string,
): Result<GameState> {
  const instance = state.cards[change.instanceId];
  const card = cardOf(state, cards, change.instanceId);
  const tokens = instance?.controlTokens;
  if (
    controllerOf(state, change.instanceId) === undefined ||
    tokens === undefined ||
    card === undefined
  ) {
    return fail('Choose a contested advantage in play.');
  }
  if (!isNonZeroInteger(change.delta) || tokens[change.side] + change.delta < 0) {
    return fail('Change control tokens by a whole number, leaving zero or more.');
  }
  const next = updateInstance(state, change.instanceId, (current) => ({
    ...current,
    controlTokens: { ...tokens, [change.side]: tokens[change.side] + change.delta },
  }));
  const whose = PLAYER_NAMES[change.side].replace('The', 'the');
  return ok(
    withLog(next, `${by} changes ${whose}'s control tokens on ${card.name} by ${change.delta}.`),
  );
}

/**
 * Replace a character in play with a card from hand, which takes over its
 * position, rotation, damage, modifiers, participation and attachments.
 *
 * @param state - The game.
 * @param side - The player replacing their own character.
 * @param change - The change.
 * @param cards - The card database.
 * @param by - Who is making it, for the log.
 * @returns The game, or why not.
 */
function replaceCharacter(
  state: GameState,
  side: DeckSide,
  change: ChangeOf<'replaceCharacter'>,
  cards: CardLookup,
  by: string,
): Result<GameState> {
  const old = state.cards[change.instanceId];
  const oldCard = cardOf(state, cards, change.instanceId);
  const location = locate(state, change.instanceId);
  const replacement = cardOf(state, cards, change.replacementId);
  if (
    old === undefined ||
    oldCard?.type !== 'Character' ||
    old.owner !== side ||
    location?.kind !== 'zone' ||
    location.side !== side ||
    (location.zone !== 'homeFront' && location.zone !== 'battleground')
  ) {
    return fail('Choose a character you own and control in play.');
  }
  if (
    !state.players[side].hand.includes(change.replacementId) ||
    replacement?.type !== 'Character'
  ) {
    return fail('Choose the replacement character from your hand.');
  }
  const problem = controlProblem(side, replacement);
  if (problem !== undefined) {
    return fail(problem);
  }

  const { zone } = location;
  let next = updatePlayer(state, side, (player) => ({
    ...player,
    hand: player.hand.filter((id) => id !== change.replacementId),
    [zone]: player[zone].map((id) => (id === change.instanceId ? change.replacementId : id)),
    removed: [...player.removed, change.instanceId],
    startingCharacter:
      player.startingCharacter === change.instanceId
        ? change.replacementId
        : player.startingCharacter,
  }));
  next = updateInstance(next, change.replacementId, (instance) => ({
    ...old,
    id: instance.id,
    cardId: instance.cardId,
  }));
  next = updateInstance(next, change.instanceId, (instance) => ({
    id: instance.id,
    cardId: instance.cardId,
    owner: instance.owner,
    rotated: false,
    damage: 0,
    lastingModifiers: instance.lastingModifiers,
    turnModifiers: instance.turnModifiers,
  }));
  for (const candidate of SIDES) {
    for (const advantageId of next.players[candidate].advantages) {
      next = updateInstance(next, advantageId, (advantage) =>
        advantage.attachedTo?.kind === 'card' &&
        advantage.attachedTo.instanceId === change.instanceId
          ? { ...advantage, attachedTo: { kind: 'card', instanceId: change.replacementId } }
          : advantage,
      );
    }
  }
  return ok(withLog(next, `${by} replaces ${oldCard.name} with ${replacement.name}.`));
}
