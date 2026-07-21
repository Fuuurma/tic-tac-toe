import { Color, PlayerSymbol } from "@/game/constants";
import { isValidMove, makeMove, type GameState } from "@/game/logic";

export type PeerMessage =
  | { type: "join"; displayName: string; guestId: string; preferredColor?: Color }
  | { type: "joined"; symbol: PlayerSymbol; color: Color; gameState: GameState }
  | { type: "gameStart"; gameState: GameState }
  | { type: "gameUpdate"; gameState: GameState }
  | { type: "move"; index: number }
  | { type: "rematchRequested"; requesterSymbol: PlayerSymbol }
  | { type: "rematchAccept" }
  | { type: "rematchDecline" }
  | { type: "leave" }
  | { type: "error"; message: string };

export const generateRoomId = (): string => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID().slice(0, 8);
  }
  return Math.random().toString(36).slice(2, 10);
};

export const applyAuthorizedMove = (
  state: GameState,
  index: number,
  actor: PlayerSymbol,
): GameState | null => {
  if (!Number.isInteger(index) || !isValidMove(state, index, actor)) return null;
  return makeMove(state, index);
};

export const isPeerMessage = (value: unknown): value is PeerMessage => {
  if (!value || typeof value !== "object" || !("type" in value)) return false;
  const message = value as Record<string, unknown>;
  switch (message.type) {
    case "join":
      return typeof message.displayName === "string" && typeof message.guestId === "string";
    case "joined":
      return isPlayerSymbol(message.symbol) && isGameState(message.gameState);
    case "gameStart":
    case "gameUpdate":
      return isGameState(message.gameState);
    case "move":
      return typeof message.index === "number" && Number.isInteger(message.index);
    case "rematchRequested":
      return isPlayerSymbol(message.requesterSymbol);
    case "rematchAccept":
    case "rematchDecline":
    case "leave":
      return true;
    case "error":
      return typeof message.message === "string";
    default:
      return false;
  }
};

const isPlayerSymbol = (value: unknown): value is PlayerSymbol =>
  value === PlayerSymbol.X || value === PlayerSymbol.O;

const VALID_GAME_STATUSES = new Set(["WAITING", "ACTIVE", "COMPLETED"]);

const isGameState = (value: unknown): value is GameState => {
  if (!value || typeof value !== "object") return false;
  const state = value as Partial<GameState>;
  if (
    !Array.isArray(state.board) ||
    state.board.length !== 9 ||
    !state.board.every((cell) => cell === null || isPlayerSymbol(cell))
  ) return false;
  if (!isPlayerSymbol(state.currentPlayer)) return false;
  if (!state.players || typeof state.players !== "object") return false;
  if (!state.moves || typeof state.moves !== "object") return false;
  const p = state.players as Record<string, unknown>;
  const m = state.moves as Record<string, unknown>;
  if (!p.X || !p.O || typeof p.X !== "object" || typeof p.O !== "object") return false;
  if (!Array.isArray(m.X) || !Array.isArray(m.O)) return false;
  if (state.winner !== null && !isPlayerSymbol(state.winner)) return false;
  if (state.gameStatus !== undefined && !VALID_GAME_STATUSES.has(state.gameStatus as string)) return false;
  if (state.maxMoves !== undefined && typeof state.maxMoves !== "number") return false;
  if (state.moveCount !== undefined && typeof state.moveCount !== "number") return false;
  if (state.nextToRemove !== undefined && typeof state.nextToRemove !== "object") return false;
  return true;
};
