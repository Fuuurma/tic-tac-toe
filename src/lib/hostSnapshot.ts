import { GAME_RULES, GameStatus, PlayerSymbol } from "@/game/constants";
import type { GameState } from "@/game/logic";
import { ROOM_ID_PATTERN } from "@/lib/roomId";
import { getBrowserSessionStorage } from "@/lib/storage";

export interface HostSnapshot {
  version: 1;
  roomId: string;
  hostSymbol: PlayerSymbol;
  gameState: GameState;
}

export const HOST_SNAPSHOT_STORAGE_KEY = "tic-tac-toe:host-snapshot";

const isPlayerSymbol = (value: unknown): value is PlayerSymbol =>
  value === PlayerSymbol.X || value === PlayerSymbol.O;

const isBoardCell = (value: unknown): boolean =>
  value === null || isPlayerSymbol(value);

const isGameStatusValue = (value: unknown): value is GameStatus =>
  value === GameStatus.WAITING ||
  value === GameStatus.ACTIVE ||
  value === GameStatus.COMPLETED;

const hasBothPlayers = (value: unknown): boolean => {
  if (!value || typeof value !== "object") return false;
  const players = value as Record<string, unknown>;
  const x = players[PlayerSymbol.X];
  const o = players[PlayerSymbol.O];
  return (
    typeof x === "object" &&
    x !== null &&
    typeof o === "object" &&
    o !== null
  );
};

const isHostSnapshot = (value: unknown): value is HostSnapshot => {
  if (!value || typeof value !== "object") return false;
  const snapshot = value as Record<string, unknown>;
  if (snapshot.version !== 1) return false;
  if (
    typeof snapshot.roomId !== "string" ||
    !ROOM_ID_PATTERN.test(snapshot.roomId)
  ) {
    return false;
  }
  if (!isPlayerSymbol(snapshot.hostSymbol)) return false;
  const gameState = snapshot.gameState;
  if (!gameState || typeof gameState !== "object") return false;
  const state = gameState as Record<string, unknown>;
  if (
    !Array.isArray(state.board) ||
    state.board.length !== GAME_RULES.BOARD_SIZE ||
    !state.board.every(isBoardCell)
  ) {
    return false;
  }
  if (!isGameStatusValue(state.gameStatus)) return false;
  return hasBothPlayers(state.players);
};

export function saveHostSnapshot(
  snapshot: HostSnapshot,
  storage: Storage | null = getBrowserSessionStorage(),
): void {
  if (!storage) return;
  try {
    storage.setItem(HOST_SNAPSHOT_STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    return;
  }
}

export function loadHostSnapshot(
  storage: Storage | null = getBrowserSessionStorage(),
): HostSnapshot | null {
  if (!storage) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(storage.getItem(HOST_SNAPSHOT_STORAGE_KEY) ?? "null");
  } catch {
    return null;
  }
  return isHostSnapshot(raw) ? raw : null;
}

export function clearHostSnapshot(
  storage: Storage | null = getBrowserSessionStorage(),
): void {
  if (!storage) return;
  try {
    storage.removeItem(HOST_SNAPSHOT_STORAGE_KEY);
  } catch {
    return;
  }
}
