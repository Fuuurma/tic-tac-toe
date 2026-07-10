import Peer, { type DataConnection } from "peerjs";
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

export const PEERJS_KEY = import.meta.env.VITE_PEERJS_KEY as string | undefined;

export const generateRoomId = (): string => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID().slice(0, 8);
  }
  return Math.random().toString(36).slice(2, 10);
};

export const createHostPeer = (roomId: string): Peer =>
  new Peer(roomId, PEERJS_KEY ? { key: PEERJS_KEY } : undefined);

export const createGuestPeer = (): Peer =>
  new Peer("", PEERJS_KEY ? { key: PEERJS_KEY } : undefined);

export const sendMessage = (conn: DataConnection, message: PeerMessage): void => {
  if (conn.open) conn.send(message);
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

const isGameState = (value: unknown): value is GameState => {
  if (!value || typeof value !== "object") return false;
  const state = value as Partial<GameState>;
  return (
    Array.isArray(state.board) &&
    state.board.length === 9 &&
    state.board.every((cell) => cell === null || isPlayerSymbol(cell)) &&
    isPlayerSymbol(state.currentPlayer) &&
    !!state.players &&
    !!state.moves
  );
};
