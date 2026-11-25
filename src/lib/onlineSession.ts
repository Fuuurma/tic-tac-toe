import {
  AVAILABLE_COLORS,
  AVAILABLE_SHAPES,
  type Color,
  type PeerSide,
  type SymbolShape,
  type TurnAction,
} from "@/game/constants";
import { sanitizeDisplayName } from "@/lib/identity";
import { ROOM_ID_PATTERN } from "@/lib/roomId";
import { getBrowserSessionStorage } from "@/lib/storage";

const ONLINE_SESSION_STORAGE_KEY = "tic-tac-toe:online-session";
const ONLINE_SESSION_VERSION = 1;

export interface OnlineSession {
  roomId: string;
  role: PeerSide;
  onlineAction: TurnAction;
  displayName: string;
  color: Color;
  playerShape: SymbolShape;
}

const isColor = (value: unknown): value is Color =>
  typeof value === "string" && (AVAILABLE_COLORS as string[]).includes(value);

const isShape = (value: unknown): value is SymbolShape =>
  typeof value === "string" && (AVAILABLE_SHAPES as string[]).includes(value);

const parseOnlineSession = (raw: unknown): OnlineSession | null => {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;
  const { version, roomId, role, onlineAction, displayName, color, playerShape } =
    record;
  if (version !== ONLINE_SESSION_VERSION) return null;
  if (typeof roomId !== "string" || !ROOM_ID_PATTERN.test(roomId)) return null;
  if (role !== "host" && role !== "guest") return null;
  if (
    onlineAction !== "quick" &&
    onlineAction !== "create" &&
    onlineAction !== "join"
  ) {
    return null;
  }
  if (!isColor(color) || !isShape(playerShape)) return null;
  if (
    typeof displayName !== "string" ||
    sanitizeDisplayName(displayName) !== displayName
  ) {
    return null;
  }
  return { roomId, role, onlineAction, displayName, color, playerShape };
};

export function readOnlineSession(
  storage: Storage | null = getBrowserSessionStorage(),
): OnlineSession | null {
  if (!storage) return null;
  try {
    const item = storage.getItem(ONLINE_SESSION_STORAGE_KEY);
    return item === null ? null : parseOnlineSession(JSON.parse(item));
  } catch {
    return null;
  }
}

export function writeOnlineSession(
  session: OnlineSession,
  storage: Storage | null = getBrowserSessionStorage(),
): void {
  if (!storage) return;
  const record = { version: ONLINE_SESSION_VERSION, ...session };
  if (parseOnlineSession(record) === null) return;
  try {
    storage.setItem(ONLINE_SESSION_STORAGE_KEY, JSON.stringify(record));
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
