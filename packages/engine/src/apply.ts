/**
 * Applying a player's action: check it against the rules, then carry the game
 * on to the next decision.
 */

import { ABILITY_TRACKS, ALLEGIANCES } from '@wot/cards';
import type { Allegiance, Card } from '@wot/cards';

import type { GameAction } from './actions.ts';
import {
  LAST_BATTLE_TRACKS,
  allyGroupProblem,
  controlProblem,
  currentAbility,
  hasTrait,
} from './cardRules.ts';
import { checkPrintedPayment, checkRecruitPayment, describeCost } from './cost.ts';
import type { PaymentSymbol } from './cost.ts';
import { damageAssignmentProblem } from './damage.ts';
import type { DamageTarget } from './damage.ts';
import { startingSideOf } from './deck/rules.ts';
import type { DeckSide } from './deck/rules.ts';
import {
  beginDamageAssignment,
  closeEventWindow,
  determineDominance,
  finishActions,
  finishGenerate,
  finishPlaceForces,
  generateEligible,
  revealChallenges,
  rollerEligible,
  rotateAndRoll,
  settleDiscards,
  settleParticipation,
  settleRollers,
} from './flow.ts';
import { applyManualChange } from './manual.ts';
import { fail, ok } from './result.ts';
import type { Result } from './result.ts';
import type {
  AttachmentTarget,
  CardLookup,
  Commitment,
  GameState,
  ResourceSymbol,
} from './state.ts';
import {
  PLAYER_NAMES,
  SIDES,
  cardOf,
  challengeName,
  convertPatternToken,
  controllerOf,
  findChallenge,
  firstPending,
  forcesOf,
  hasDuplicates,
  maxHandSize,
  moveCard,
  nameOf,
  opponentOf,
  participantsOf,
  updateInstance,
  updatePlayer,
  withLog,
} from './stateOps.ts';

/** The action of one type. */
type ActionOf<T extends GameAction['type']> = Extract<GameAction, { readonly type: T }>;

/**
 * Apply an action.
 *
 * @param state - The game.
 * @param action - What a player does.
 * @param cards - The card database.
 * @returns The game at its next decision, or why the action is not allowed.
 */
export function applyAction(
  state: GameState,
  action: GameAction,
  cards: CardLookup,
): Result<GameState> {
  if (state.step.kind === 'gameOver') {
    return fail('The game is over.');
  }
  switch (action.type) {
    case 'revealDragonReborn':
      return revealDragonReborn(state, action, cards);
    case 'declareChallenge':
      return declareChallenge(state, action, cards);
    case 'placeForces':
      return placeForces(state, action, cards);
    case 'commitParticipation':
      return commitParticipation(state, action, cards);
    case 'generateSymbols':
      return generateSymbols(state, action, cards);
    case 'endGenerateResources':
      return endGenerateResources(state, action, cards);
    case 'recruit':
      return recruit(state, action, cards);
    case 'playAdvantage':
      return playAdvantage(state, action, cards);
    case 'playLimitedEvent':
      return playLimitedEvent(state, action, cards);
    case 'heal':
      return heal(state, action, cards);
    case 'reinforce':
      return reinforce(state, action, cards);
    case 'endActions':
      return endActions(state, action);
    case 'declareRollers':
      return declareRollers(state, action, cards);
    case 'assignDamage':
      return assignDamage(state, action, cards);
    case 'playEvent':
      return playEvent(state, action, cards);
    case 'taverenHeal':
      return taverenHeal(state, action, cards);
    case 'pass':
      return pass(state, action, cards);
    case 'discardDown':
      return discardDown(state, action, cards);
    case 'manual':
      return applyManualChange(state, action.side, action.change, cards);
  }
}

/**
 * Reveal the face-down Dragon Reborn at the start of the Last Battle, or not.
 *
 * @param state - The game.
 * @param action - The action.
 * @param cards - The card database.
 * @returns The game, or why not.
 */
function revealDragonReborn(
  state: GameState,
  action: ActionOf<'revealDragonReborn'>,
  cards: CardLookup,
): Result<GameState> {
  const step = state.step;
  if (step.kind !== 'revealDragonReborn' || step.side !== action.side) {
    return fail('There is no face-down Dragon Reborn for you to reveal now.');
  }
  const faceDownId = state.players[action.side].faceDownDragonReborn;
  const player = PLAYER_NAMES[action.side];
  if (faceDownId === undefined || !action.reveal) {
    return ok(determineDominance(withLog(state, `${player} leaves the Dragon Reborn face down.`)));
  }
  const name = nameOf(state, cards, faceDownId);
  const dragonInPlay = SIDES.some((side) =>
    forcesOf(state, side).some((id) => {
      const card = cardOf(state, cards, id);
      return card !== undefined && hasTrait(card, 'Dragon Reborn');
    }),
  );
  const next = dragonInPlay
    ? withLog(
        moveCard(state, faceDownId, action.side, 'discard'),
        `${player} reveals ${name}, but the Dragon Reborn is already in play, so it is discarded.`,
      )
    : withLog(
        moveCard(state, faceDownId, action.side, 'homeFront'),
        `${player} reveals ${name} and takes control of it.`,
      );
  return ok(determineDominance(next));
}

/**
 * Declare a challenge face down, or decline.
 *
 * @param state - The game.
 * @param action - The action.
 * @param cards - The card database.
 * @returns The game, or why not.
 */
function declareChallenge(
  state: GameState,
  action: ActionOf<'declareChallenge'>,
  cards: CardLookup,
): Result<GameState> {
  const step = state.step;
  if (step.kind !== 'declareChallenges') {
    return fail('Challenges are not being declared now.');
  }
  if (firstPending(state, step.declarations) !== action.side) {
    return fail('It is not your turn to declare a challenge.');
  }
  const { declaration } = action;
  let privately = 'You declare no challenge.';
  if (declaration.kind === 'card') {
    const card = cardOf(state, cards, declaration.instanceId);
    if (
      !state.players[action.side].hand.includes(declaration.instanceId) ||
      card?.type !== 'Challenge'
    ) {
      return fail('Choose a challenge card from your hand.');
    }
    privately = `You play ${card.name} face down.`;
  } else if (declaration.kind === 'contested') {
    const card = cardOf(state, cards, declaration.advantageInstanceId);
    const inPlay = SIDES.some((side) =>
      state.players[side].advantages.includes(declaration.advantageInstanceId),
    );
    if (
      !inPlay ||
      card === undefined ||
      !(hasTrait(card, 'Contested Advantage') || hasTrait(card, 'Nation Contested Advantage'))
    ) {
      return fail('Choose a contested advantage in play.');
    }
    privately = `You will contest control of ${card.name}.`;
  }
  const declarations = { ...step.declarations, [action.side]: declaration };
  const next = withLog(
    { ...state, step: { kind: 'declareChallenges', declarations } },
    privately,
    action.side,
  );
  return ok(firstPending(next, declarations) === undefined ? revealChallenges(next, cards) : next);
}

/**
 * Move home front forces to the battleground.
 *
 * @param state - The game.
 * @param action - The action.
 * @param cards - The card database.
 * @returns The game, or why not.
 */
function placeForces(
  state: GameState,
  action: ActionOf<'placeForces'>,
  cards: CardLookup,
): Result<GameState> {
  const step = state.step;
  if (step.kind !== 'placeForces' || step.side !== action.side) {
    return fail('It is not your turn to place forces.');
  }
  const homeFront = state.players[action.side].homeFront;
  if (
    hasDuplicates(action.instanceIds) ||
    !action.instanceIds.every((id) => homeFront.includes(id))
  ) {
    return fail('Choose cards at your home front, each once.');
  }
  let next = state;
  for (const id of action.instanceIds) {
    next = moveCard(next, id, action.side, 'battleground');
  }
  const names = action.instanceIds.map((id) => nameOf(state, cards, id));
  next = withLog(
    next,
    names.length === 0
      ? `${PLAYER_NAMES[action.side]} keeps every force at the home front.`
      : `${PLAYER_NAMES[action.side]} moves ${names.join(', ')} to the battleground.`,
  );
  return ok(finishPlaceForces(next, action.side));
}

/**
 * Why a card may not join a challenge on its own terms, if it may not.
 *
 * @param state - The game.
 * @param cards - The card database.
 * @param instanceId - The card.
 * @param challengeId - The challenge.
 * @returns The reason, or undefined when it may join.
 */
function joinProblem(
  state: GameState,
  cards: CardLookup,
  instanceId: string,
  challengeId: string,
): string | undefined {
  const challenge = findChallenge(state, challengeId);
  const instance = state.cards[instanceId];
  const card = cardOf(state, cards, instanceId);
  if (challenge === undefined || challenge.outcome !== undefined) {
    return 'That challenge is not waiting to be resolved.';
  }
  if (instance === undefined || card === undefined) {
    return 'That card is not in the game.';
  }
  if (
    challenge.kind === 'lastBattle' &&
    !LAST_BATTLE_TRACKS.some((track) => currentAbility(instance, card, track) > 0)
  ) {
    return `${card.name} cannot roll Intrigue, One Power or Combat, so it must stand down in the Last Battle.`;
  }
  if (challenge.kind === 'contested' && challenge.advantageInstanceId !== undefined) {
    const advantage = cardOf(state, cards, challenge.advantageInstanceId);
    const nation: Allegiance | undefined = ALLEGIANCES.find(
      (allegiance) => allegiance === advantage?.name,
    );
    if (
      advantage !== undefined &&
      hasTrait(advantage, 'Nation Contested Advantage') &&
      nation !== undefined &&
      !card.allegiances.includes(nation)
    ) {
      return `Only ${nation} characters and troops can participate in the contest for ${advantage.name}.`;
    }
  }
  return undefined;
}

/**
 * Why a player's cards may not participate together in their challenges, if
 * they may not.
 *
 * @param state - The game.
 * @param cards - The card database.
 * @param side - The player.
 * @param additions - Cards about to join challenges.
 * @returns The reason, or undefined when every group is allowed.
 */
function groupsProblem(
  state: GameState,
  cards: CardLookup,
  side: DeckSide,
  additions: readonly Commitment[],
): string | undefined {
  for (const challenge of state.challenges) {
    const ids = [
      ...participantsOf(state, challenge.id, side),
      ...additions
        .filter((commitment) => commitment.challengeId === challenge.id)
        .map((commitment) => commitment.instanceId),
    ];
    const group = ids.map((id) => cardOf(state, cards, id)).filter((card) => card !== undefined);
    const problem = allyGroupProblem(group);
    if (problem !== undefined) {
      return problem;
    }
  }
  return undefined;
}

/**
 * Commit battleground cards to challenges.
 *
 * @param state - The game.
 * @param action - The action.
 * @param cards - The card database.
 * @returns The game, or why not.
 */
function commitParticipation(
  state: GameState,
  action: ActionOf<'commitParticipation'>,
  cards: CardLookup,
): Result<GameState> {
  const step = state.step;
  if (step.kind !== 'determineParticipation') {
    return fail('Participation is not being decided now.');
  }
  if (firstPending(state, step.commitments) !== action.side) {
    return fail('It is not your turn to commit cards.');
  }
  const battleground = state.players[action.side].battleground;
  if (hasDuplicates(action.commitments.map((commitment) => commitment.instanceId))) {
    return fail('A card can participate in only one challenge.');
  }
  for (const commitment of action.commitments) {
    if (!battleground.includes(commitment.instanceId)) {
      return fail('Only your cards in the battleground can participate.');
    }
    const problem = joinProblem(state, cards, commitment.instanceId, commitment.challengeId);
    if (problem !== undefined) {
      return fail(problem);
    }
  }
  const groupProblem = groupsProblem(state, cards, action.side, action.commitments);
  if (groupProblem !== undefined) {
    return fail(groupProblem);
  }
  const commitments = { ...step.commitments, [action.side]: action.commitments };
  return ok(settleParticipation(state, commitments));
}

/**
 * Rotate a home front character to generate symbols.
 *
 * @param state - The game.
 * @param action - The action.
 * @param cards - The card database.
 * @returns The game, or why not.
 */
function generateSymbols(
  state: GameState,
  action: ActionOf<'generateSymbols'>,
  cards: CardLookup,
): Result<GameState> {
  const step = state.step;
  if (step.kind !== 'generateResources' || step.side !== action.side) {
    return fail('It is not your turn to generate symbols.');
  }
  if (!generateEligible(state, cards, action.side).includes(action.instanceId)) {
    return fail('Choose a ready character at your home front with an ability to roll.');
  }
  const rolled = rotateAndRoll(state, cards, action.instanceId, ABILITY_TRACKS, false).state;
  return ok(
    generateEligible(rolled, cards, action.side).length === 0
      ? finishGenerate(rolled, cards, action.side)
      : rolled,
  );
}

/**
 * Finish generating symbols.
 *
 * @param state - The game.
 * @param action - The action.
 * @param cards - The card database.
 * @returns The game, or why not.
 */
function endGenerateResources(
  state: GameState,
  action: ActionOf<'endGenerateResources'>,
  cards: CardLookup,
): Result<GameState> {
  const step = state.step;
  if (step.kind !== 'generateResources' || step.side !== action.side) {
    return fail('It is not your turn to generate symbols.');
  }
  return ok(finishGenerate(state, cards, action.side));
}

/** Symbols chosen from a pool, ready to spend. */
interface ChosenSymbols {
  /** The symbols as payment, with their allegiances now. */
  readonly payment: readonly PaymentSymbol[];
  /** The pool without them. */
  readonly remaining: readonly ResourceSymbol[];
}

/**
 * Pick symbols out of a player's pool.
 *
 * @param state - The game.
 * @param cards - The card database.
 * @param side - The player.
 * @param symbolIds - The symbols.
 * @returns The payment and what is left, or why the symbols cannot be used.
 */
function chooseSymbols(
  state: GameState,
  cards: CardLookup,
  side: DeckSide,
  symbolIds: readonly string[],
): Result<ChosenSymbols> {
  if (hasDuplicates(symbolIds)) {
    return fail('Choose each symbol once.');
  }
  const pool = state.players[side].pool;
  const payment: PaymentSymbol[] = [];
  for (const id of symbolIds) {
    const symbol = pool.find((candidate) => candidate.id === id);
    if (symbol === undefined) {
      return fail('A chosen symbol is not in your pool.');
    }
    const allegiances =
      symbol.source.kind === 'card'
        ? (cardOf(state, cards, symbol.source.instanceId)?.allegiances ?? [])
        : symbol.source.allegiances;
    payment.push({ track: symbol.track, allegiances });
  }
  return ok({ payment, remaining: pool.filter((symbol) => !symbolIds.includes(symbol.id)) });
}

/**
 * Why a card may not enter play, if it may not: the one-copy, killed pile and
 * Unique rules.
 *
 * @param state - The game.
 * @param card - The card.
 * @returns The reason, or undefined when it may enter play.
 */
function entryProblem(state: GameState, card: Card): string | undefined {
  function copies(ids: readonly string[]): boolean {
    return ids.some((id) => state.cards[id]?.cardId === card.id);
  }
  if (hasTrait(card, 'Unique') && state.enteredUnique.includes(card.id)) {
    return `${card.name} is Unique and a copy has already been in play.`;
  }
  if (hasTrait(card, 'Multiple') || card.type === 'Advantage') {
    return undefined;
  }
  if (SIDES.some((side) => copies(forcesOf(state, side)))) {
    return `A copy of ${card.name} is already in play.`;
  }
  if (
    card.type === 'Character' &&
    SIDES.some((side) => copies(state.players[side].killed) || copies(state.players[side].removed))
  ) {
    return `A copy of ${card.name} has been killed or removed from play, so it may not enter play again.`;
  }
  return undefined;
}

/**
 * Note a Unique card entering play.
 *
 * @param state - The game.
 * @param card - The card entering play.
 * @returns The game.
 */
function recordEntry(state: GameState, card: Card): GameState {
  return hasTrait(card, 'Unique') && !state.enteredUnique.includes(card.id)
    ? { ...state, enteredUnique: [...state.enteredUnique, card.id] }
    : state;
}

/**
 * Recruit a character or troop from hand.
 *
 * @param state - The game.
 * @param action - The action.
 * @param cards - The card database.
 * @returns The game, or why not.
 */
function recruit(
  state: GameState,
  action: ActionOf<'recruit'>,
  cards: CardLookup,
): Result<GameState> {
  const { side } = action;
  const step = state.step;
  if (step.kind !== 'takeActions' || step.side !== side) {
    return fail('You can only recruit during your Take Actions step.');
  }
  const card = cardOf(state, cards, action.instanceId);
  if (
    !state.players[side].hand.includes(action.instanceId) ||
    card === undefined ||
    (card.type !== 'Character' && card.type !== 'Troop')
  ) {
    return fail('Choose a character or troop from your hand.');
  }
  const startingSide = startingSideOf(card);
  if (startingSide !== undefined) {
    return fail(
      `${card.name} is a Starting ${startingSide === 'hero' ? 'Hero' : 'Villain'} and can never be recruited.`,
    );
  }
  const problem = controlProblem(side, card) ?? entryProblem(state, card);
  if (problem !== undefined) {
    return fail(problem);
  }
  if (action.patternConversions > state.pattern[side]) {
    return fail(`You have only ${state.pattern[side]} Pattern tokens to convert.`);
  }
  const chosen = chooseSymbols(state, cards, side, action.symbolIds);
  if (!chosen.ok) {
    return chosen;
  }
  const payment = checkRecruitPayment(card, side, chosen.value.payment, action.patternConversions);
  if (!payment.ok) {
    return payment;
  }

  let next = updatePlayer(state, side, (player) => ({ ...player, pool: chosen.value.remaining }));
  for (let conversion = 0; conversion < action.patternConversions; conversion += 1) {
    next = convertPatternToken(next, side);
  }
  next = recordEntry(moveCard(next, action.instanceId, side, 'homeFront'), card);
  const converted =
    action.patternConversions === 0
      ? ''
      : `, converting ${action.patternConversions} Pattern token${action.patternConversions === 1 ? '' : 's'}`;
  return ok(
    withLog(
      next,
      `${PLAYER_NAMES[side]} recruits ${card.name} for ${describeCost(payment.value)}${converted}.`,
    ),
  );
}

/**
 * Whether two attachment targets are the same.
 *
 * @param a - One target.
 * @param b - The other.
 * @returns True when they name the same card, player or the world.
 */
function sameTarget(a: AttachmentTarget | undefined, b: AttachmentTarget): boolean {
  if (a === undefined || a.kind !== b.kind) {
    return false;
  }
  if (a.kind === 'card' && b.kind === 'card') {
    return a.instanceId === b.instanceId;
  }
  if (a.kind === 'player' && b.kind === 'player') {
    return a.side === b.side;
  }
  return true;
}

/**
 * Why an advantage may not go on a target, if it may not.
 *
 * @param state - The game.
 * @param cards - The card database.
 * @param side - The player playing it.
 * @param card - The advantage.
 * @param target - The proposed target.
 * @returns The reason, or undefined when the target is allowed.
 */
function advantageTargetProblem(
  state: GameState,
  cards: CardLookup,
  side: DeckSide,
  card: Card,
  target: AttachmentTarget,
): string | undefined {
  if (target.kind === 'card') {
    const targetCard = cardOf(state, cards, target.instanceId);
    const inPlay = SIDES.some((candidate) =>
      forcesOf(state, candidate).includes(target.instanceId),
    );
    const allowed = card.subtype === undefined ? ['Character', 'Troop'] : [card.subtype];
    if (!inPlay || targetCard === undefined || !allowed.includes(targetCard.type)) {
      return `${card.name} must go on a ${allowed.join(' or ').toLowerCase()} in play.`;
    }
    if (hasTrait(card, 'Weapon')) {
      const armed = SIDES.some((candidate) =>
        state.players[candidate].advantages.some((id) => {
          const other = cardOf(state, cards, id);
          return (
            other !== undefined &&
            hasTrait(other, 'Weapon') &&
            sameTarget(state.cards[id]?.attachedTo, target)
          );
        }),
      );
      if (armed) {
        return `${targetCard.name} already has a weapon.`;
      }
    }
  } else if (target.kind === 'player') {
    if (card.subtype !== 'Player' || target.side !== side) {
      return `${card.name} is not a player advantage you can play on yourself.`;
    }
  } else if (card.subtype !== 'World') {
    return `${card.name} is not a world advantage.`;
  }
  const duplicate = SIDES.some((candidate) =>
    state.players[candidate].advantages.some(
      (id) =>
        state.cards[id]?.cardId === card.id && sameTarget(state.cards[id]?.attachedTo, target),
    ),
  );
  return duplicate ? `That target already has a copy of ${card.name}.` : undefined;
}

/**
 * Play an advantage from hand.
 *
 * @param state - The game.
 * @param action - The action.
 * @param cards - The card database.
 * @returns The game, or why not.
 */
function playAdvantage(
  state: GameState,
  action: ActionOf<'playAdvantage'>,
  cards: CardLookup,
): Result<GameState> {
  const { side } = action;
  const step = state.step;
  if (step.kind !== 'takeActions' || step.side !== side) {
    return fail('You can only play advantages during your Take Actions step.');
  }
  const card = cardOf(state, cards, action.instanceId);
  if (!state.players[side].hand.includes(action.instanceId) || card?.type !== 'Advantage') {
    return fail('Choose an advantage from your hand.');
  }
  const problem =
    advantageTargetProblem(state, cards, side, card, action.target) ?? entryProblem(state, card);
  if (problem !== undefined) {
    return fail(problem);
  }
  const chosen = chooseSymbols(state, cards, side, action.symbolIds);
  if (!chosen.ok) {
    return chosen;
  }
  const payment = checkPrintedPayment(card, chosen.value.payment);
  if (!payment.ok) {
    return payment;
  }

  let next = updatePlayer(state, side, (player) => ({ ...player, pool: chosen.value.remaining }));
  next = moveCard(next, action.instanceId, side, 'advantages');
  const contested =
    hasTrait(card, 'Contested Advantage') || hasTrait(card, 'Nation Contested Advantage');
  next = updateInstance(next, action.instanceId, (instance) => ({
    ...instance,
    attachedTo: action.target,
    ...(contested ? { controlTokens: { hero: 0, villain: 0 } } : {}),
  }));
  const on =
    action.target.kind === 'card'
      ? ` on ${nameOf(state, cards, action.target.instanceId)}`
      : action.target.kind === 'player'
        ? ''
        : ' on the world';
  return ok(withLog(recordEntry(next, card), `${PLAYER_NAMES[side]} plays ${card.name}${on}.`));
}

/**
 * Play a limited event from hand.
 *
 * @param state - The game.
 * @param action - The action.
 * @param cards - The card database.
 * @returns The game, or why not.
 */
function playLimitedEvent(
  state: GameState,
  action: ActionOf<'playLimitedEvent'>,
  cards: CardLookup,
): Result<GameState> {
  const { side } = action;
  const step = state.step;
  if (step.kind !== 'takeActions' || step.side !== side) {
    return fail('You can only play limited events during your Take Actions step.');
  }
  const card = cardOf(state, cards, action.instanceId);
  if (
    !state.players[side].hand.includes(action.instanceId) ||
    card?.type !== 'Event' ||
    card.subtype !== 'Limited'
  ) {
    return fail('Choose a limited event from your hand.');
  }
  return spendAndDiscard(
    state,
    cards,
    side,
    action.instanceId,
    card,
    action.symbolIds,
    'the limited event',
  );
}

/**
 * Pay for an event and discard it once played.
 *
 * @param state - The game.
 * @param cards - The card database.
 * @param side - The player.
 * @param instanceId - The event in hand.
 * @param card - Its card data.
 * @param symbolIds - Symbols to pay with.
 * @param label - How the log describes the card.
 * @returns The game, or why not.
 */
function spendAndDiscard(
  state: GameState,
  cards: CardLookup,
  side: DeckSide,
  instanceId: string,
  card: Card,
  symbolIds: readonly string[],
  label: string,
): Result<GameState> {
  const chosen = chooseSymbols(state, cards, side, symbolIds);
  if (!chosen.ok) {
    return chosen;
  }
  const payment = checkPrintedPayment(card, chosen.value.payment);
  if (!payment.ok) {
    return payment;
  }
  const next = moveCard(
    updatePlayer(state, side, (player) => ({ ...player, pool: chosen.value.remaining })),
    instanceId,
    side,
    'discard',
  );
  return ok(
    withLog(
      next,
      `${PLAYER_NAMES[side]} plays ${label} ${card.name}. Its text is applied by hand.`,
    ),
  );
}

/**
 * Rotate a home front card to heal a point of damage.
 *
 * @param state - The game.
 * @param action - The action.
 * @param cards - The card database.
 * @returns The game, or why not.
 */
function heal(state: GameState, action: ActionOf<'heal'>, cards: CardLookup): Result<GameState> {
  const step = state.step;
  if (step.kind !== 'takeActions' || step.side !== action.side) {
    return fail('You can only heal during your Take Actions step.');
  }
  const instance = state.cards[action.instanceId];
  if (
    !state.players[action.side].homeFront.includes(action.instanceId) ||
    instance === undefined ||
    instance.rotated ||
    instance.damage === 0
  ) {
    return fail('Choose a ready, damaged card at your home front.');
  }
  const next = updateInstance(state, action.instanceId, (current) => ({
    ...current,
    rotated: true,
    damage: current.damage - 1,
  }));
  return ok(
    withLog(next, `${nameOf(state, cards, action.instanceId)} rotates to heal a point of damage.`),
  );
}

/**
 * Have a standing-down card with Reinforcement join a challenge.
 *
 * @param state - The game.
 * @param action - The action.
 * @param cards - The card database.
 * @returns The game, or why not.
 */
function reinforce(
  state: GameState,
  action: ActionOf<'reinforce'>,
  cards: CardLookup,
): Result<GameState> {
  const { side } = action;
  const step = state.step;
  if (step.kind !== 'takeActions' || step.side !== side) {
    return fail('You can only reinforce during your Take Actions step.');
  }
  const instance = state.cards[action.instanceId];
  const card = cardOf(state, cards, action.instanceId);
  if (
    !state.players[side].battleground.includes(action.instanceId) ||
    instance === undefined ||
    card === undefined ||
    !hasTrait(card, 'Reinforcement') ||
    instance.challengeId !== undefined
  ) {
    return fail('Choose a standing-down card with Reinforcement in your battleground.');
  }
  const commitment = { instanceId: action.instanceId, challengeId: action.challengeId };
  const problem =
    joinProblem(state, cards, action.instanceId, action.challengeId) ??
    groupsProblem(state, cards, side, [commitment]);
  if (problem !== undefined) {
    return fail(problem);
  }
  const challenge = findChallenge(state, action.challengeId);
  const next = updateInstance(state, action.instanceId, (current) => ({
    ...current,
    challengeId: action.challengeId,
  }));
  const name = challenge === undefined ? 'a challenge' : challengeName(state, cards, challenge);
  return ok(withLog(next, `${card.name} reinforces ${name}.`));
}

/**
 * Finish taking actions.
 *
 * @param state - The game.
 * @param action - The action.
 * @returns The game, or why not.
 */
function endActions(state: GameState, action: ActionOf<'endActions'>): Result<GameState> {
  const step = state.step;
  if (step.kind !== 'takeActions' || step.side !== action.side) {
    return fail('It is not your Take Actions step.');
  }
  return ok(finishActions(state, action.side));
}

/**
 * Announce which participants rotate to roll.
 *
 * @param state - The game.
 * @param action - The action.
 * @param cards - The card database.
 * @returns The game, or why not.
 */
function declareRollers(
  state: GameState,
  action: ActionOf<'declareRollers'>,
  cards: CardLookup,
): Result<GameState> {
  const step = state.step;
  if (step.kind !== 'declareRollers') {
    return fail('Nobody is announcing rolls now.');
  }
  if (firstPending(state, step.rollers) !== action.side) {
    return fail('It is not your turn to announce rolls.');
  }
  const eligible = rollerEligible(state, cards, step.challengeId, step.stage, action.side);
  if (
    hasDuplicates(action.instanceIds) ||
    !action.instanceIds.every((id) => eligible.includes(id))
  ) {
    return fail(
      step.stage === 'openingMoves'
        ? 'Choose ready participating characters, each once.'
        : 'Choose ready participating troops, each once.',
    );
  }
  const names = action.instanceIds.map((id) => nameOf(state, cards, id));
  const next = withLog(
    state,
    names.length === 0
      ? `${PLAYER_NAMES[action.side]} rolls nothing.`
      : `${PLAYER_NAMES[action.side]} will roll ${names.join(', ')}.`,
  );
  const rollers = { ...step.rollers, [action.side]: action.instanceIds };
  return ok(settleRollers(next, cards, step.challengeId, step.stage, rollers));
}

/**
 * Place damage from the opponent's pool on your own participants.
 *
 * @param state - The game.
 * @param action - The action.
 * @param cards - The card database.
 * @returns The game, or why not.
 */
function assignDamage(
  state: GameState,
  action: ActionOf<'assignDamage'>,
  cards: CardLookup,
): Result<GameState> {
  const step = state.step;
  if (step.kind !== 'assignDamage' || step.side !== action.side) {
    return fail('It is not your turn to assign damage.');
  }
  const wanted = step.stage === 'openingMoves' ? 'Character' : 'Troop';
  const targets: DamageTarget[] = [];
  for (const id of participantsOf(state, step.challengeId, action.side)) {
    const instance = state.cards[id];
    const card = cardOf(state, cards, id);
    if (instance !== undefined && card?.type === wanted) {
      targets.push({ instance, card });
    }
  }
  const problem = damageAssignmentProblem(targets, action.assignments, step.owed[action.side]);
  if (problem !== undefined) {
    return fail(problem);
  }
  let next = state;
  for (const assignment of action.assignments) {
    next = updateInstance(next, assignment.instanceId, (instance) => ({
      ...instance,
      damage: instance.damage + assignment.damage,
    }));
  }
  const placed = action.assignments
    .map((assignment) => `${assignment.damage} on ${nameOf(state, cards, assignment.instanceId)}`)
    .join(', ');
  next = withLog(next, `${PLAYER_NAMES[action.side]} places damage: ${placed}.`);
  const owed = { ...step.owed, [action.side]: 0 };
  return ok(beginDamageAssignment(next, step.challengeId, step.stage, owed));
}

/**
 * Why a player may not play an event right now, if they may not.
 *
 * @param state - The game.
 * @param side - The player.
 * @returns The reason, or undefined when events may be played.
 */
function eventTimingProblem(state: GameState, side: DeckSide): string | undefined {
  const step = state.step;
  switch (step.kind) {
    case 'eventWindow':
      return step.priority === side
        ? undefined
        : 'The other player may play an event or pass first.';
    case 'placeForces':
    case 'takeActions':
    case 'declareRollers':
      return undefined;
    default:
      return 'Events cannot be played right now.';
  }
}

/**
 * Hand priority to the other player after an event in an event window.
 *
 * @param state - The game.
 * @param side - The player who played the event.
 * @returns The game.
 */
function afterEvent(state: GameState, side: DeckSide): GameState {
  const step = state.step;
  return step.kind === 'eventWindow'
    ? { ...state, step: { ...step, priority: opponentOf(side), passes: 0 } }
    : state;
}

/**
 * Play an event from hand.
 *
 * @param state - The game.
 * @param action - The action.
 * @param cards - The card database.
 * @returns The game, or why not.
 */
function playEvent(
  state: GameState,
  action: ActionOf<'playEvent'>,
  cards: CardLookup,
): Result<GameState> {
  const timing = eventTimingProblem(state, action.side);
  if (timing !== undefined) {
    return fail(timing);
  }
  const card = cardOf(state, cards, action.instanceId);
  if (!state.players[action.side].hand.includes(action.instanceId) || card?.type !== 'Event') {
    return fail('Choose an event from your hand.');
  }
  if (card.subtype === 'Limited') {
    return fail(`${card.name} is a limited event, played only during your Take Actions step.`);
  }
  const played = spendAndDiscard(
    state,
    cards,
    action.side,
    action.instanceId,
    card,
    action.symbolIds,
    'the event',
  );
  return played.ok ? ok(afterEvent(played.value, action.side)) : played;
}

/**
 * Convert a Pattern token to remove a point of damage from a Ta'veren, as an event.
 *
 * @param state - The game.
 * @param action - The action.
 * @param cards - The card database.
 * @returns The game, or why not.
 */
function taverenHeal(
  state: GameState,
  action: ActionOf<'taverenHeal'>,
  cards: CardLookup,
): Result<GameState> {
  const timing = eventTimingProblem(state, action.side);
  if (timing !== undefined) {
    return fail(timing);
  }
  if (action.side !== 'hero') {
    return fail("Only the Hero player can heal a Ta'veren this way.");
  }
  const instance = state.cards[action.instanceId];
  const card = cardOf(state, cards, action.instanceId);
  if (
    controllerOf(state, action.instanceId) !== 'hero' ||
    instance === undefined ||
    card === undefined ||
    !hasTrait(card, "Ta'veren") ||
    instance.damage === 0
  ) {
    return fail("Choose a damaged Ta'veren you control.");
  }
  if (state.pattern.hero === 0) {
    return fail('You have no Pattern tokens to convert.');
  }
  const next = updateInstance(convertPatternToken(state, 'hero'), action.instanceId, (current) => ({
    ...current,
    damage: current.damage - 1,
  }));
  return ok(
    afterEvent(
      withLog(
        next,
        `The Hero player converts a Pattern token to remove a point of damage from ${card.name}.`,
      ),
      action.side,
    ),
  );
}

/**
 * Pass in an event window.
 *
 * @param state - The game.
 * @param action - The action.
 * @param cards - The card database.
 * @returns The game, or why not.
 */
function pass(state: GameState, action: ActionOf<'pass'>, cards: CardLookup): Result<GameState> {
  const step = state.step;
  if (step.kind !== 'eventWindow' || step.priority !== action.side) {
    return fail('There is nothing for you to pass on.');
  }
  if (step.passes + 1 >= 2) {
    return ok(closeEventWindow(state, cards));
  }
  return ok({
    ...state,
    step: { ...step, priority: opponentOf(action.side), passes: step.passes + 1 },
  });
}

/**
 * Choose cards to discard in the Discard Cards step.
 *
 * @param state - The game.
 * @param action - The action.
 * @param cards - The card database.
 * @returns The game, or why not.
 */
function discardDown(
  state: GameState,
  action: ActionOf<'discardDown'>,
  cards: CardLookup,
): Result<GameState> {
  const step = state.step;
  if (step.kind !== 'discardDown') {
    return fail('Cards are not being discarded now.');
  }
  if (firstPending(state, step.discards) !== action.side) {
    return fail('It is not your turn to discard.');
  }
  const player = state.players[action.side];
  if (
    hasDuplicates(action.instanceIds) ||
    !action.instanceIds.every((id) => player.hand.includes(id))
  ) {
    return fail('Choose cards from your hand, each once.');
  }
  const limit = maxHandSize(player);
  if (player.hand.length - action.instanceIds.length > limit) {
    return fail(`Discard down to ${limit} cards.`);
  }
  const discards = { ...step.discards, [action.side]: action.instanceIds };
  return ok(settleDiscards(state, cards, discards));
}
