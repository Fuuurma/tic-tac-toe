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

export interface OnlineSession {
  roomId: string;
  role: PeerSide;
  onlineAction: TurnAction;
  displayName: string;
  color: Color;
  playerShape: SymbolShape;
}

const ONLINE_SESSION_KEY = "tic-tac-toe:online-session";
const ONLINE_SESSION_VERSION = 1;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

function parseSessionFacts(value: unknown): OnlineSession | null {
  if (!isRecord(value)) return null;
  const { roomId, role, onlineAction, displayName, color, playerShape } = value;
  if (typeof roomId !== "string" || !ROOM_ID_PATTERN.test(roomId)) return null;
  if (role !== "host" && role !== "guest") return null;
  if (
    onlineAction !== "quick" &&
    onlineAction !== "create" &&
    onlineAction !== "join"
  ) {
    return null;
  }
  if (
    typeof displayName !== "string" ||
    displayName.length === 0 ||
    sanitizeDisplayName(displayName) !== displayName
  ) {
    return null;
  }
  if (
    typeof color !== "string" ||
    !AVAILABLE_COLORS.includes(color as Color)
  ) {
    return null;
  }
  if (
    typeof playerShape !== "string" ||
    !AVAILABLE_SHAPES.includes(playerShape as SymbolShape)
  ) {
    return null;
  }
  return {
    roomId,
    role: role as PeerSide,
    onlineAction: onlineAction as TurnAction,
    displayName,
    color: color as Color,
    playerShape: playerShape as SymbolShape,
  };
}

export function readOnlineSession(
  storage: Storage | null = getBrowserSessionStorage(),
): OnlineSession | null {
  if (!storage) return null;
  let raw: string | null;
  try {
    raw = storage.getItem(ONLINE_SESSION_KEY);
  } catch {
    return null;
  }
  if (raw === null) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(parsed) || parsed.version !== ONLINE_SESSION_VERSION) {
    return null;
  }
  return parseSessionFacts(parsed);
}

export function writeOnlineSession(
  session: OnlineSession,
  storage: Storage | null = getBrowserSessionStorage(),
): void {
  const facts = parseSessionFacts(session);
  if (!facts || !storage) return;
  try {
    storage.setItem(
      ONLINE_SESSION_KEY,
      JSON.stringify({ version: ONLINE_SESSION_VERSION, ...facts }),
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
