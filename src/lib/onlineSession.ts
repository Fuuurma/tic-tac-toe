import {
  AI_Difficulty,
  AVAILABLE_COLORS,
  AVAILABLE_SHAPES,
  GameModes,
  PLAYER_CONFIG,
  PlayerSymbol,
  PlayerTypes,
  oppositeColor,
  type Color,
  type GameSetup,
  type PeerSide,
  type SymbolShape,
  type TurnAction,
} from "@/game/constants";
import { sanitizeDisplayName } from "@/lib/identity";
import { ROOM_ID_PATTERN } from "@/lib/roomId";
import { getBrowserSessionStorage } from "@/lib/storage";

export const ONLINE_SESSION_STORAGE_KEY = "tic-tac-toe:online-session";
const ONLINE_SESSION_VERSION = 1;

export interface OnlineSession {
  roomId: string;
  role: PeerSide;
  onlineAction: TurnAction;
  displayName: string;
  color: Color;
  playerShape: SymbolShape;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isPeerSide = (value: unknown): value is PeerSide =>
  value === "host" || value === "guest";

const isTurnAction = (value: unknown): value is TurnAction =>
  value === "quick" || value === "create" || value === "join";

const isColor = (value: unknown): value is Color =>
  typeof value === "string" &&
  (AVAILABLE_COLORS as string[]).includes(value);

const isShape = (value: unknown): value is SymbolShape =>
  typeof value === "string" &&
  (AVAILABLE_SHAPES as string[]).includes(value);

const isCanonicalDisplayName = (value: unknown): value is string =>
  typeof value === "string" && sanitizeDisplayName(value) === value;

const isOnlineSession = (value: unknown): value is OnlineSession => {
  if (!isRecord(value)) return false;
  return (
    typeof value.roomId === "string" &&
    ROOM_ID_PATTERN.test(value.roomId) &&
    isPeerSide(value.role) &&
    isTurnAction(value.onlineAction) &&
    isCanonicalDisplayName(value.displayName) &&
    isColor(value.color) &&
    isShape(value.playerShape)
  );
};

const parseStoredSession = (raw: string | null): OnlineSession | null => {
  if (raw === null) return null;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (
    !isRecord(data) ||
    data.version !== ONLINE_SESSION_VERSION ||
    !isOnlineSession(data)
  ) {
    return null;
  }
  return {
    roomId: data.roomId,
    role: data.role,
    onlineAction: data.onlineAction,
    displayName: data.displayName,
    color: data.color,
    playerShape: data.playerShape,
  };
};

export function readOnlineSession(
  storage: Storage | null = getBrowserSessionStorage(),
): OnlineSession | null {
  if (!storage) return null;
  let raw: string | null;
  try {
    raw = storage.getItem(ONLINE_SESSION_STORAGE_KEY);
  } catch {
    return null;
  }
  return parseStoredSession(raw);
}

export function writeOnlineSession(
  session: OnlineSession,
  storage: Storage | null = getBrowserSessionStorage(),
): void {
  if (!storage || !isOnlineSession(session)) return;
  try {
    storage.setItem(
      ONLINE_SESSION_STORAGE_KEY,
      JSON.stringify({
        version: ONLINE_SESSION_VERSION,
        roomId: session.roomId,
        role: session.role,
        onlineAction: session.onlineAction,
        displayName: session.displayName,
        color: session.color,
        playerShape: session.playerShape,
      }),
    );
  } catch {
    return;
  }
}

export function clearOnlineSession(
  storage: Storage | null = getBrowserSessionStorage(),
): void {
  if (!storage) return;
  try {
    storage.removeItem(ONLINE_SESSION_STORAGE_KEY);
  } catch {
    return;
  }
}

export function gameSetupFromOnlineSession(session: OnlineSession): GameSetup {
  return {
    displayName: session.displayName,
    color: session.color,
    opponentColor: oppositeColor(session.color),
    playerShape: session.playerShape,
    opponentShape: PLAYER_CONFIG[PlayerSymbol.O].defaultShape,
    gameMode: GameModes.ONLINE,
    aiDifficulty: AI_Difficulty.NORMAL,
    opponentName: "",
    opponentType: PlayerTypes.HUMAN,
    onlineRoomId: session.roomId,
    onlineAction: session.onlineAction,
    resumeRole: session.role,
  };
}
