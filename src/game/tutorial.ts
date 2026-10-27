import {
  AI_Difficulty,
  Color,
  GAME_RULES,
  GameModes,
  PlayerSymbol,
  type PlayerProfile,
  SymbolShape,
  oppositeColor,
} from "./constants";
import {
  createInitialGameState,
  getValidMoves,
  isGameActive,
  makeMove,
  type GameState,
} from "./logic";

/**
 * The guided practice game shown to a first-time player. It runs on the real
 * engine, so every rule they see is the rule they will play by: this module
 * only decides who they face and what to say, never what a move does.
 *
 * The player is always X and moves first. The AI is a sparring partner with
 * one job: let the player SEE a mark vanish before anything else can happen.
 * It blocks while the player is still learning, so no win can land before
 * their 4th mark, then lets them win.
 */

const HUMAN = PlayerSymbol.X;
const AI = PlayerSymbol.O;

/** One past the limit: the first mark that retires an older one. */
const FIRST_VANISH_MOVE = GAME_RULES.MAX_MOVES_PER_PLAYER + 1;

/** Centre, corners, then edges: a plausible opener without being a threat. */
const AI_PREFERENCE = [4, 0, 2, 6, 8, 1, 3, 5, 7];

type TutorialProfile = PlayerProfile;

export type LessonStage = "place" | "limit" | "vanished" | "win" | "won";

/**
 * The lobby's default opposite, except gray: its marks nearly vanish against
 * the board's dark well, and in a lesson the opponent has to be seen.
 */
const rivalColor = (color: Color): Color => {
  const opposite = oppositeColor(color);
  return opposite === Color.GRAY ? Color.BLUE : opposite;
};

export function createTutorialGame(profile: TutorialProfile): GameState {
  return createInitialGameState({
    gameMode: GameModes.VS_COMPUTER,
    playerXName: profile.displayName,
    playerOName: "AI",
    playerColor: profile.color,
    opponentColor: rivalColor(profile.color),
    playerShape: profile.shape,
    // Never the player's own symbol, or two marks on the board look alike.
    opponentShape: profile.shape === SymbolShape.O ? SymbolShape.X : SymbolShape.O,
    humanSymbol: HUMAN,
    aiDifficulty: AI_Difficulty.EASY,
  });
}

/** Marks the player has placed, vanished or not. They always move first. */
export const humanMoveCount = (state: GameState): number =>
  Math.ceil(state.moveCount / 2);

/**
 * Where the lesson stands. It is derived from the game rather than stored, so
 * it cannot drift from the board: placing a mark is the only way forward.
 */
export function lessonStage(state: GameState): LessonStage {
  if (state.winner === HUMAN) return "won";
  const placed = humanMoveCount(state);
  if (placed < FIRST_VANISH_MOVE - 1) return "place";
  if (placed === FIRST_VANISH_MOVE - 1) return "limit";
  if (placed === FIRST_VANISH_MOVE) return "vanished";
  return "win";
}

/**
 * The cell where `symbol` would win next, or null. Asked of the engine itself
 * so that vanishing is honoured: a line that needs the mark about to vanish
 * is not offered. Answers for a side that is not on the move.
 */
export function findWinningMove(state: GameState, symbol: PlayerSymbol): number | null {
  if (!isGameActive(state)) return null;
  const asIfOnTheMove: GameState = { ...state, currentPlayer: symbol };
  for (const cell of getValidMoves(state.board)) {
    if (makeMove(asIfOnTheMove, cell)?.winner === symbol) return cell;
  }
  return null;
}

/**
 * The sparring partner's reply. It never wins. While the player is learning it
 * blocks their winning cell; from their 4th mark on it looks away.
 */
export function tutorialAIMove(state: GameState): number | null {
  if (!isGameActive(state) || state.currentPlayer !== AI) return null;

  const empty = getValidMoves(state.board);
  const safe = empty.filter((cell) => makeMove(state, cell)?.winner !== AI);
  const options = safe.length > 0 ? safe : empty;

  const threat = findWinningMove(state, HUMAN);
  if (threat !== null && options.includes(threat)) {
    if (humanMoveCount(state) < FIRST_VANISH_MOVE) return threat;
    const looksAway = options.filter((cell) => cell !== threat);
    if (looksAway.length > 0) return pickPreferred(looksAway);
  }
  return pickPreferred(options);
}

const pickPreferred = (cells: number[]): number =>
  AI_PREFERENCE.find((cell) => cells.includes(cell)) ?? cells[0];
