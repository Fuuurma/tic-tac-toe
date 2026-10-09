import {
  AI_Difficulty,
  AVAILABLE_COLORS,
  AVAILABLE_SHAPES,
  type Color,
  type SymbolShape,
  type AI_Difficulty as AI_DifficultyType,
} from "@/game/constants";
import { sanitizeDisplayName } from "@/lib/identity";

/**
 * Appearance and opponent choices the player set in the Settings sheet,
 * persisted as one JSON blob so future sessions reopen with the same setup.
 * The display name lives under the identity key instead (saveDisplayName)
 * because the guest-identity seam already owns its validation and fallback.
 *
 * Every field is validated against its enum on read: a hand-edited or stale
 * localStorage blob degrades to defaults, never to a broken render.
 */
export interface GamePreferences {
  color?: Color;
  playerShape?: SymbolShape;
  opponentColor?: Color;
  opponentShape?: SymbolShape;
  opponentName?: string;
  aiDifficulty?: AI_DifficultyType;
}

const PREFERENCES_STORAGE_KEY = "tic-tac-toe:preferences";

const getBrowserStorage = (): Storage | null => {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

const isColor = (v: unknown): v is Color =>
  typeof v === "string" && (AVAILABLE_COLORS as string[]).includes(v);

const isShape = (v: unknown): v is SymbolShape =>
  typeof v === "string" && (AVAILABLE_SHAPES as string[]).includes(v);

const isDifficulty = (v: unknown): v is AI_DifficultyType =>
  typeof v === "string" &&
  (Object.values(AI_Difficulty) as string[]).includes(v);

export function loadPreferences(
  storage: Storage | null = getBrowserStorage(),
): GamePreferences {
  if (!storage) return {};
  let raw: unknown;
  try {
    raw = JSON.parse(storage.getItem(PREFERENCES_STORAGE_KEY) ?? "null");
  } catch {
    return {};
  }
  if (typeof raw !== "object" || raw === null) return {};
  const prefs = raw as Record<string, unknown>;
  const out: GamePreferences = {};
  if (isColor(prefs.color)) out.color = prefs.color;
  if (isShape(prefs.playerShape)) out.playerShape = prefs.playerShape;
  if (isColor(prefs.opponentColor)) out.opponentColor = prefs.opponentColor;
  if (isShape(prefs.opponentShape)) out.opponentShape = prefs.opponentShape;
  const opponentName = sanitizeDisplayName(
    typeof prefs.opponentName === "string" ? prefs.opponentName : null,
    "",
  );
  if (opponentName) out.opponentName = opponentName;
  if (isDifficulty(prefs.aiDifficulty)) out.aiDifficulty = prefs.aiDifficulty;
  return out;
}

export function savePreferences(
  patch: GamePreferences,
  storage: Storage | null = getBrowserStorage(),
): void {
  if (!storage) return;
  try {
    const merged = { ...loadPreferences(storage), ...patch };
    storage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(merged));
  } catch {
    // QuotaExceededError / SecurityError — preferences are best-effort
  }
}
