import {
  AI_Difficulty,
  AVAILABLE_COLORS,
  Color,
  GAME_RULES,
  GameModes,
  GameStatus,
  PlayerSymbol,
  PlayerTypes,
  SymbolShape,
  TURN_DURATION_MS,
  WINNING_COMBINATIONS,
  oppositeSymbol,
  type AI_Difficulty as _AI_DifficultyType,
  type GameMode as _GameModeType,
  type GameStatus as _GameStatusType,
  type PlayerType as _PlayerTypeType,
} from "@/game/constants";
import { isValidMove, makeMove, type GameState } from "@/game/logic";
import { sanitizeDisplayName } from "@/lib/identity";

export type PeerMessage =
  | { type: "join"; displayName: string; guestId: string; preferredColor?: Color }
  | { type: "joined"; symbol: PlayerSymbol; color: Color; gameState: GameState }
  | { type: "gameStart"; symbol: PlayerSymbol; gameState: GameState }
  | { type: "gameUpdate"; gameState: GameState }
  | { type: "move"; index: number }
  | { type: "rematchRequested"; requesterSymbol: PlayerSymbol }
  | { type: "rematchAccept" }
  | { type: "rematchDecline" }
  | { type: "rematchCancel" }
  | { type: "leave" }
  | { type: "error"; message: string };

/** Hard upper bound on inbound wire-message scalar string fields. */
export const PEER_MAX_ID_LENGTH = 64;
/** Display names come from forms/sanitizers but a wire peer can spoof length. */
export const PEER_MAX_NAME_LENGTH = 20;
/** Allowed move indices are 0..BOARD_SIZE-1 — keep a numeric guard rail here too. */
export const PEER_MAX_BOARD_INDEX = GAME_RULES.BOARD_SIZE - 1;
/** Turn timer wire values must stay inside the configured duration window. */
export const PEER_MAX_TURN_MS = TURN_DURATION_MS;
/** Absolute timer deadlines must remain finite safe integers on the wire. */
export const PEER_MAX_TURN_DEADLINE = Number.MAX_SAFE_INTEGER;
/** Error strings on the wire are UX copy, not an unbounded dump. */
export const PEER_MAX_ERROR_LENGTH = 200;

const fallbackRoomId = (): string =>
  `${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`.padEnd(32, "0").slice(0, 32);

export const generateRoomId = (): string => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return fallbackRoomId();
};

export const chooseGuestColor = (preferred: Color | undefined, hostColor: Color): Color => {
  if (preferred && preferred !== hostColor) return preferred;
  return AVAILABLE_COLORS.find((color) => color !== hostColor) ?? Color.GRAY;
};

export const peerLeftUserMessage = (
  role: "host" | "guest",
  reason: "disconnect" | "closed" | "expired",
): string => {
  if (reason === "disconnect") {
    return role === "guest"
      ? "Host disconnected. Reconnecting…"
      : "Opponent disconnected. Reconnecting…";
  }
  if (reason === "expired") {
    return role === "guest"
      ? "Host did not reconnect in time"
      : "Opponent did not reconnect in time";
  }
  return role === "guest" ? "Host left the room" : "Opponent left the room";
};

export type HostGuestJoinResult = {
  kind: "accepted" | "resync";
  /** The HOST's live state — always keeps its own turnDeadlineAt. */
  gameState: GameState;
  /** The payload to SEND to the guest. On resync this strips the
   *  stored deadline (computed before any disconnect) and carries
   *  turnTimeRemaining instead, so the guest resynthesizes fresh. */
  wireGameState: GameState;
  guestSymbol: PlayerSymbol;
  guestColor: Color;
};

/** Wire payload for any host→guest state send. The absolute
 *  `turnDeadlineAt` is computed on the HOST clock — a guest whose clock
 *  skews would honor it verbatim and corrupt its displayed countdown
 *  (devin 09-01 finding; forfeits stay host-authoritative). Strip it and
 *  send the remaining duration instead: the guest anchors
 *  `now + turnTimeRemaining` on its own clock, trading skew for one-way
 *  latency. */
export const toWireGameState = (
  state: GameState,
  now: number = Date.now(),
): GameState => ({
  ...state,
  turnDeadlineAt: undefined,
  turnTimeRemaining:
    state.turnDeadlineAt !== undefined
      ? Math.max(0, state.turnDeadlineAt - now)
      : state.turnTimeRemaining,
});

/** First join starts the match. Later joins (reconnect) resync without resetting. */
export const applyHostGuestJoin = (
  state: GameState,
  hostSymbol: PlayerSymbol,
  join: { displayName: string; preferredColor?: Color },
  now: number = Date.now(),
): HostGuestJoinResult => {
  const guestSymbol = oppositeSymbol(hostSymbol);
  if (state.gameStatus !== GameStatus.WAITING) {
    const guest = state.players[guestSymbol];
    // Resync (docs/DESIGN-resync-rollback): the stored deadline was
    // computed on the host clock before any disconnect, so a guest gone
    // for minutes would honor a stale/expired timer. Send the REMAINING
    // time instead — the guest's synthesis path (now +
    // turnTimeRemaining) always produces a fresh deadline.
    return {
      kind: "resync",
      gameState: state,
      wireGameState: toWireGameState(state, now),
      guestSymbol,
      guestColor: guest.color,
    };
  }

  const guestColor = chooseGuestColor(join.preferredColor, state.players[hostSymbol].color);
  const guestName = sanitizeDisplayName(join.displayName, "Guest");
  const gameState: GameState = {
    ...state,
    gameStatus: GameStatus.ACTIVE,
    turnTimeRemaining: TURN_DURATION_MS,
    turnDeadlineAt: now + TURN_DURATION_MS,
    players: {
      ...state.players,
      [guestSymbol]: {
        username: guestName,
        color: guestColor,
        symbol: guestSymbol,
        shape: state.players[guestSymbol].shape,
        type: PlayerTypes.HUMAN,
        lastMoveAt: now,
      },
    },
  };
  return {
    kind: "accepted",
    gameState,
    wireGameState: toWireGameState(gameState, now),
    guestSymbol,
    guestColor,
  };
};

export const applyAuthorizedMove = (
  state: GameState,
  index: number,
  actor: PlayerSymbol,
): GameState | null => {
  if (
    !Number.isInteger(index) ||
    index < 0 ||
    index > PEER_MAX_BOARD_INDEX ||
    !isValidMove(state, index, actor)
  ) {
    return null;
  }
  return makeMove(state, index);
};

const isPlayerSymbol = (value: unknown): value is PlayerSymbol =>
  value === PlayerSymbol.X || value === PlayerSymbol.O;

const VALID_COLORS: ReadonlySet<string> = new Set(AVAILABLE_COLORS);
const isColor = (value: unknown): value is Color =>
  typeof value === "string" && VALID_COLORS.has(value);

const VALID_SHAPES: ReadonlySet<string> = new Set(Object.values(SymbolShape));
const isSymbolShape = (value: unknown): value is SymbolShape =>
  typeof value === "string" && VALID_SHAPES.has(value);

const VALID_GAME_STATUSES: ReadonlySet<_GameStatusType> = new Set([
  GameStatus.WAITING,
  GameStatus.ACTIVE,
  GameStatus.COMPLETED,
] as _GameStatusType[]);
const isGameStatus = (value: unknown): value is _GameStatusType =>
  typeof value === "string" && VALID_GAME_STATUSES.has(value as _GameStatusType);

const VALID_GAME_MODES: ReadonlySet<_GameModeType> = new Set([
  GameModes.VS_COMPUTER,
  GameModes.VS_FRIEND,
  GameModes.ONLINE,
] as _GameModeType[]);
const isGameMode = (value: unknown): value is _GameModeType =>
  typeof value === "string" && VALID_GAME_MODES.has(value as _GameModeType);

const VALID_AI_DIFFICULTIES: ReadonlySet<_AI_DifficultyType> = new Set([
  AI_Difficulty.EASY,
  AI_Difficulty.NORMAL,
  AI_Difficulty.HARD,
] as _AI_DifficultyType[]);
const isAiDifficulty = (value: unknown): value is _AI_DifficultyType =>
  typeof value === "string" &&
  VALID_AI_DIFFICULTIES.has(value as _AI_DifficultyType);

const VALID_PLAYER_TYPES: ReadonlySet<_PlayerTypeType> = new Set([
  PlayerTypes.HUMAN,
  PlayerTypes.COMPUTER,
] as _PlayerTypeType[]);
const isPlayerType = (value: unknown): value is _PlayerTypeType =>
  typeof value === "string" && VALID_PLAYER_TYPES.has(value as _PlayerTypeType);

const isBoundedCellIndex = (value: unknown): value is number =>
  typeof value === "number" &&
  Number.isInteger(value) &&
  value >= 0 &&
  value <= PEER_MAX_BOARD_INDEX;

const isBoundedIndexArray = (
  value: unknown,
  maxLength: number,
): value is number[] =>
  Array.isArray(value) &&
  value.length <= maxLength &&
  value.every(isBoundedCellIndex);

/** A winning combination must be one of the known WINNING_COMBINATIONS rows. */
const isWinningCombination = (
  value: unknown,
): value is readonly [number, number, number] => {
  if (!Array.isArray(value) || value.length !== 3) return false;
  if (!value.every(isBoundedCellIndex)) return false;
  const sorted = [...(value as number[])].sort((a, b) => a - b);
  return WINNING_COMBINATIONS.some((combo) => {
    const cs = [...combo].sort((a, b) => a - b);
    return cs[0] === sorted[0] && cs[1] === sorted[1] && cs[2] === sorted[2];
  });
};

const isBoundedDisplayName = (value: unknown): value is string =>
  typeof value === "string" &&
  value.length > 0 &&
  value.length <= PEER_MAX_NAME_LENGTH;

const isBoundedIdentifier = (value: unknown): value is string =>
  typeof value === "string" &&
  value.length > 0 &&
  value.length <= PEER_MAX_ID_LENGTH;

const isBoundedOptionalColor = (
  value: unknown,
): value is Color | undefined =>
  value === undefined || isColor(value);

const isBoardCell = (value: unknown): boolean =>
  value === null || isPlayerSymbol(value);

const isPlayerConfig = (value: unknown): boolean => {
  if (!value || typeof value !== "object") return false;
  const p = value as Record<string, unknown>;
  if (!isBoundedDisplayName(p.username)) return false;
  if (!isColor(p.color)) return false;
  if (!isPlayerSymbol(p.symbol)) return false;
  if (!isSymbolShape(p.shape)) return false;
  if (!isPlayerType(p.type)) return false;
  if (
    p.lastMoveAt !== undefined &&
    p.lastMoveAt !== null &&
    !(typeof p.lastMoveAt === "number" && Number.isFinite(p.lastMoveAt))
  ) {
    return false;
  }
  return true;
};

const isGameState = (value: unknown): value is GameState => {
  if (!value || typeof value !== "object") return false;
  const state = value as Record<string, unknown>;

  if (
    !Array.isArray(state.board) ||
    state.board.length !== GAME_RULES.BOARD_SIZE ||
    !state.board.every(isBoardCell)
  ) {
    return false;
  }
  if (!isPlayerSymbol(state.currentPlayer)) return false;
  if (state.winner !== null && !isPlayerSymbol(state.winner)) return false;
  // winningCombination must be either null or a real winning line.
  if (state.winningCombination !== null && !isWinningCombination(state.winningCombination)) {
    return false;
  }
  if (state.lastMoveIndex !== null && !isBoundedCellIndex(state.lastMoveIndex)) {
    return false;
  }

  const players = state.players as Record<string, unknown> | undefined;
  if (!players || !isPlayerConfig(players.X) || !isPlayerConfig(players.O)) {
    return false;
  }

  const moves = state.moves as Record<string, unknown> | undefined;
  if (!moves) return false;
  if (
    !isBoundedIndexArray(moves.X, GAME_RULES.MAX_MOVES_PER_PLAYER) ||
    !isBoundedIndexArray(moves.O, GAME_RULES.MAX_MOVES_PER_PLAYER)
  ) {
    return false;
  }

  const nextToRemove = state.nextToRemove as Record<string, unknown> | undefined;
  if (!nextToRemove) return false;
  if (
    !(nextToRemove.X === null || isBoundedCellIndex(nextToRemove.X)) ||
    !(nextToRemove.O === null || isBoundedCellIndex(nextToRemove.O))
  ) {
    return false;
  }

  if (
    typeof state.maxMoves !== "number" ||
    !Number.isInteger(state.maxMoves) ||
    state.maxMoves < 1 ||
    state.maxMoves > GAME_RULES.MAX_MOVES_PER_PLAYER
  ) {
    return false;
  }

  if (
    typeof state.moveCount !== "number" ||
    !Number.isInteger(state.moveCount) ||
    state.moveCount < 0
  ) {
    return false;
  }

  if (!isGameStatus(state.gameStatus)) return false;

  if (!isGameMode(state.gameMode)) return false;

  if (state.aiDifficulty !== undefined && !isAiDifficulty(state.aiDifficulty)) {
    return false;
  }

  // Timer wire values must be inside the configured window. A peer could
  // otherwise spoof a near-zero value to force a randomized fallback move
  // or a value past the duration to deny the timer entirely.
  if (
    state.turnTimeRemaining !== undefined &&
    state.turnTimeRemaining !== null &&
    !(typeof state.turnTimeRemaining === "number" &&
      Number.isFinite(state.turnTimeRemaining) &&
      state.turnTimeRemaining >= 0 &&
      state.turnTimeRemaining <= PEER_MAX_TURN_MS)
  ) {
    return false;
  }

  if (
    state.turnDeadlineAt !== undefined &&
    state.turnDeadlineAt !== null &&
    !(typeof state.turnDeadlineAt === "number" &&
      Number.isSafeInteger(state.turnDeadlineAt) &&
      state.turnDeadlineAt >= 0 &&
      // Upper bound: deadline must be within a reasonable window (24h
      // from now, plus a clock-skew tolerance). The raw `Date.now()`
      // bound dropped legitimate updates whenever the two devices'
      // clocks differed by more than the remaining turn time (devin
      // 09-07 20:05 finding 4) — the sender's clock may simply be
      // behind ours. The absolute ceiling still blocks the
      // years-ahead garbage the P15 fix targeted.
      state.turnDeadlineAt <= Date.now() + PEER_CLOCK_SKEW_TOLERANCE_MS + 24 * 60 * 60 * 1000)
  ) {
    return false;
  }

  return true;
};

/**
 * Clock-skew tolerance for wall-clock fields in peer payloads (devin
 * 09-07 20:05 finding 4): two devices' clocks can legitimately differ
 * by minutes; validation must not reject a frame whose deadline was
 * computed against the sender's clock. Five minutes is far beyond any
 * plausible NTP-disciplined skew and far below anything that would
 * break the timer display.
 */
export const PEER_CLOCK_SKEW_TOLERANCE_MS = 5 * 60 * 1000;

export const isPeerMessage = (value: unknown): value is PeerMessage => {
  if (!value || typeof value !== "object" || !("type" in value)) return false;
  const message = value as Record<string, unknown>;
  switch (message.type) {
    case "join":
      return (
        isBoundedDisplayName(message.displayName) &&
        isBoundedIdentifier(message.guestId) &&
        isBoundedOptionalColor(message.preferredColor)
      );
    case "joined":
      return (
        isPlayerSymbol(message.symbol) &&
        isColor(message.color) &&
        isGameState(message.gameState)
      );
    case "gameStart":
      return isGameState(message.gameState) && isPlayerSymbol(message.symbol);
    case "gameUpdate":
      return isGameState(message.gameState);
    case "move":
      return isBoundedCellIndex(message.index);
    case "rematchRequested":
      return isPlayerSymbol(message.requesterSymbol);
    case "rematchAccept":
    case "rematchDecline":
    case "rematchCancel":
    case "leave":
      return true;
    case "error":
      return (
        typeof message.message === "string" &&
        message.message.length > 0 &&
        message.message.length <= PEER_MAX_ERROR_LENGTH
      );
    default:
      return false;
  }
};
