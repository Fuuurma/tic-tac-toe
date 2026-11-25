import {
  AVAILABLE_COLORS,
  AVAILABLE_SHAPES,
  type Color,
  type PeerSide,
  type SymbolShape,
  type TurnAction,
} from "@/game/constants";
import { ROOM_ID_PATTERN } from "@/lib/roomId";
import { getBrowserSessionStorage } from "@/lib/storage";

export const ONLINE_SESSION_KEY = "tictactoe:online-session";
const ONLINE_SESSION_VERSION = 1;

export interface OnlineSession {
  roomId: string;
  role: PeerSide;
  onlineAction: TurnAction;
  displayName: string;
  color: Color;
  playerShape: SymbolShape;
}

const isPeerSide = (value: unknown): value is PeerSide =>
  value === "host" || value === "guest";

const isTurnAction = (value: unknown): value is TurnAction =>
  value === "quick" || value === "create" || value === "join";

const isColor = (value: unknown): value is Color =>
  typeof value === "string" && (AVAILABLE_COLORS as string[]).includes(value);

const isShape = (value: unknown): value is SymbolShape =>
  typeof value === "string" && (AVAILABLE_SHAPES as string[]).includes(value);

function parseOnlineSession(raw: unknown): OnlineSession | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;
  if (record.version !== ONLINE_SESSION_VERSION) return null;
  if (typeof record.roomId !== "string" || !ROOM_ID_PATTERN.test(record.roomId)) {
    return null;
  }
  if (!isPeerSide(record.role)) return null;
  if (!isTurnAction(record.onlineAction)) return null;
  if (
    typeof record.displayName !== "string" ||
    record.displayName.trim() === ""
  ) {
    return null;
  }
  if (!isColor(record.color)) return null;
  if (!isShape(record.playerShape)) return null;
  return {
    roomId: record.roomId,
    role: record.role,
    onlineAction: record.onlineAction,
    displayName: record.displayName,
    color: record.color,
    playerShape: record.playerShape,
  };
}

export function readOnlineSession(
  storage: Storage | null = getBrowserSessionStorage(),
): OnlineSession | null {
  if (!storage) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(storage.getItem(ONLINE_SESSION_KEY) ?? "null");
  } catch {
    return null;
  }
  return parseOnlineSession(parsed);
}

export function writeOnlineSession(
  session: OnlineSession,
  storage: Storage | null = getBrowserSessionStorage(),
): void {
  if (!storage) return;
  try {
    storage.setItem(
      ONLINE_SESSION_KEY,
      JSON.stringify({ version: ONLINE_SESSION_VERSION, ...session }),
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
    storage.removeItem(ONLINE_SESSION_KEY);
  } catch {
    return;
  }
}
