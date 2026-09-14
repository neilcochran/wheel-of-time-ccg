export type { DamageAssignment, GameAction, ManualChange, ManualDestination } from './actions.ts';

export { applyAction } from './apply.ts';

export {
  LAST_BATTLE_TRACKS,
  currentAbility,
  damageUntilMortallyWounded,
  isMortallyWounded,
} from './cardRules.ts';

export type { Cost, PaymentSymbol } from './cost.ts';

export { checkPrintedPayment, checkRecruitPayment, describeCost, printedCost } from './cost.ts';

export type { DeckIssue, DeckIssueCode, DeckReport } from './deck/checkDeck.ts';

export { checkDeck } from './deck/checkDeck.ts';

export type { Deck, DeckEntry } from './deck/deck.ts';

export {
  addCopy,
  copiesOf,
  createDeck,
  deckSize,
  newDeckId,
  removeCopy,
  renameDeck,
  setFaceDownDragonReborn,
  setStartingAdvantage,
  setStartingCharacter,
  setStartingHand,
} from './deck/deck.ts';

export type { DeckSide } from './deck/rules.ts';

export {
  MAX_COPIES,
  MIN_DECK_SIZE,
  STARTING_HAND_OTHER_CARDS,
  TOURNAMENT_MIN_DECK_SIZE,
  forbiddenSideOf,
  isCharacterOrTroop,
  isDragonRebornStartingHero,
  isStartingAdvantage,
  needsFaceDownDragonReborn,
  startingSideOf,
} from './deck/rules.ts';

export type { DiceTally, DieFace, DieSymbol } from './dice.ts';

export { DIE_FACES } from './dice.ts';

export type { RandomState } from './random.ts';

export type { Result } from './result.ts';

export type { GameSetup } from './setup.ts';

export { createGame } from './setup.ts';

export type {
  AbilityModifiers,
  AttachmentTarget,
  CardInstance,
  CardLookup,
  Challenge,
  ChallengeDeclaration,
  ChallengeKind,
  ChallengeOutcome,
  Commitment,
  EventWindowPoint,
  GameState,
  LastBattleOutcome,
  LogEntry,
  Pattern,
  PatternSection,
  PlayerState,
  ResolutionStage,
  ResourceSymbol,
  Step,
  SymbolSource,
} from './state.ts';

export { GAME_STATE_VERSION } from './state.ts';

export { BASE_HAND_SIZE, LAST_BATTLE_PATTERN, SIDES, opponentOf } from './stateOps.ts';

export type { GameView, PlayerView, StepView } from './view.ts';

export { viewFor, waitingOn } from './view.ts';
