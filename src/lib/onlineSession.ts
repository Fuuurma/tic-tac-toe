import {
  Color,
  SymbolShape,
  type PeerSide,
  type TurnAction,
} from "@/game/constants";
import { sanitizeDisplayName } from "@/lib/identity";
import { ROOM_ID_PATTERN } from "@/lib/roomId";
import { getBrowserSessionStorage } from "@/lib/storage";

export const ONLINE_SESSION_KEY = "tic-tac-toe:online-session";
export const ONLINE_SESSION_VERSION = 1;

export interface OnlineSession {
  version: typeof ONLINE_SESSION_VERSION;
  roomId: string;
  role: PeerSide;
  onlineAction: TurnAction;
  displayName: string;
  color: Color;
  playerShape: SymbolShape;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isPeerSide = (value: unknown): value is PeerSide =>
  value === "host" || value === "guest";

const isTurnAction = (value: unknown): value is TurnAction =>
  value === "create" || value === "join" || value === "quick";

const isColor = (value: unknown): value is Color =>
  typeof value === "string" &&
  (Object.values(Color) as string[]).includes(value);

const isSymbolShape = (value: unknown): value is SymbolShape =>
  typeof value === "string" &&
  (Object.values(SymbolShape) as string[]).includes(value);

const isCanonicalDisplayName = (value: unknown): value is string =>
  typeof value === "string" && sanitizeDisplayName(value) === value;

const isRoomId = (value: unknown): value is string =>
  typeof value === "string" && ROOM_ID_PATTERN.test(value);

function isOnlineSession(value: unknown): value is OnlineSession {
  if (!isRecord(value)) return false;
  return (
    value.version === ONLINE_SESSION_VERSION &&
    isRoomId(value.roomId) &&
    isPeerSide(value.role) &&
    isTurnAction(value.onlineAction) &&
    isCanonicalDisplayName(value.displayName) &&
    isColor(value.color) &&
    isSymbolShape(value.playerShape)
  );
}

export function readOnlineSession(
  storage: Storage | null = getBrowserSessionStorage(),
): OnlineSession | null {
  if (!storage) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(storage.getItem(ONLINE_SESSION_KEY) ?? "null");
  } catch {
    return null;
  }
  if (!isOnlineSession(raw)) return null;
  return {
    version: ONLINE_SESSION_VERSION,
    roomId: raw.roomId,
    role: raw.role,
    onlineAction: raw.onlineAction,
    displayName: raw.displayName,
    color: raw.color,
    playerShape: raw.playerShape,
  };
}

export function writeOnlineSession(
  session: OnlineSession,
  storage: Storage | null = getBrowserSessionStorage(),
): boolean {
  if (!storage || !isOnlineSession(session)) return false;
  try {
    storage.setItem(ONLINE_SESSION_KEY, JSON.stringify(session));
    return true;
  } catch {
    return false;
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
