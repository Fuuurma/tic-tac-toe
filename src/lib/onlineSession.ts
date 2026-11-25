import {
  AVAILABLE_COLORS,
  AVAILABLE_SHAPES,
  LEGACY_SHAPES,
  type Color,
  type PeerSide,
  type SymbolShape,
  type TurnAction,
} from "@/game/constants";
import { sanitizeDisplayName } from "@/lib/identity";
import { normalizeRoomId } from "@/lib/roomId";
import { getBrowserSessionStorage } from "@/lib/storage";

export const ONLINE_SESSION_STORAGE_KEY = "tic-tac-toe:online-session";
const ONLINE_SESSION_VERSION = 1;

export interface OnlineSession {
  version: typeof ONLINE_SESSION_VERSION;
  roomId: string;
  role: PeerSide;
  onlineAction: TurnAction;
  displayName: string;
  color: Color;
  playerShape: SymbolShape;
}

export type OnlineSessionDraft = Omit<OnlineSession, "version">;

const isPeerSide = (value: unknown): value is PeerSide =>
  value === "host" || value === "guest";

const isTurnAction = (value: unknown): value is TurnAction =>
  value === "quick" || value === "create" || value === "join";

const isColor = (value: unknown): value is Color =>
  typeof value === "string" && (AVAILABLE_COLORS as string[]).includes(value);

const isShape = (value: unknown): value is SymbolShape =>
  typeof value === "string" && (AVAILABLE_SHAPES as string[]).includes(value);

const readShape = (value: unknown): SymbolShape | undefined =>
  isShape(value) ? value : typeof value === "string" ? LEGACY_SHAPES[value] : undefined;

export function readOnlineSession(
  storage: Storage | null = getBrowserSessionStorage(),
): OnlineSession | null {
  if (!storage) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(storage.getItem(ONLINE_SESSION_STORAGE_KEY) ?? "null");
  } catch {
    return null;
  }
  if (typeof raw !== "object" || raw === null) return null;
  const record = raw as Record<string, unknown>;
  const {
    version,
    roomId: rawRoomId,
    role,
    onlineAction,
    displayName: rawDisplayName,
    color,
    playerShape: rawPlayerShape,
  } = record;
  if (version !== ONLINE_SESSION_VERSION) return null;
  const roomId = typeof rawRoomId === "string" ? normalizeRoomId(rawRoomId) : "";
  if (!roomId) return null;
  if (!isPeerSide(role)) return null;
  if (!isTurnAction(onlineAction)) return null;
  const displayName =
    typeof rawDisplayName === "string"
      ? sanitizeDisplayName(rawDisplayName, "")
      : "";
  if (!displayName) return null;
  if (!isColor(color)) return null;
  const playerShape = readShape(rawPlayerShape);
  if (!playerShape) return null;
  return {
    version: ONLINE_SESSION_VERSION,
    roomId,
    role,
    onlineAction,
    displayName,
    color,
    playerShape,
  };
}

export function writeOnlineSession(
  session: OnlineSessionDraft,
  storage: Storage | null = getBrowserSessionStorage(),
): void {
  if (!storage) return;
  try {
    storage.setItem(
      ONLINE_SESSION_STORAGE_KEY,
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
    storage.removeItem(ONLINE_SESSION_STORAGE_KEY);
  } catch {
    return;
  }
}
