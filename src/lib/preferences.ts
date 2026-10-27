import {
  AI_Difficulty,
  AVAILABLE_COLORS,
  AVAILABLE_SHAPES,
  LEGACY_SHAPES,
  type Color,
  type SymbolShape,
  type AI_Difficulty as AI_DifficultyType,
} from "@/game/constants";
import { sanitizeDisplayName } from "@/lib/identity";
import { getBrowserStorage } from "@/lib/storage";

export type AppTheme = "light" | "dark";

/** BCP 47 primary-language subtag the UI renders in. Only what ships a
 * dictionary is accepted; anything else falls back to English.
 *
 * Stored under its own key (see i18n/language), NOT in this blob: the
 * onboarding gate treats any tic-tac-toe:* key as "returning visitor", and
 * merely picking a language must not end a first run. */
export type Locale = "en" | "es";

/**
 * Theme, player appearance, and opponent choices from the Settings sheet,
 * persisted as one JSON blob so future sessions reopen with the same setup.
 * The display name lives under the identity key instead (saveDisplayName)
 * because the guest-identity seam already owns its validation and fallback.
 *
 * Every field is validated against its enum on read: a hand-edited or stale
 * localStorage blob degrades to defaults, never to a broken render.
 */
interface GamePreferences {
  theme?: AppTheme;
  color?: Color;
  playerShape?: SymbolShape;
  opponentColor?: Color;
  opponentShape?: SymbolShape;
  opponentName?: string;
  aiDifficulty?: AI_DifficultyType;
}

const PREFERENCES_STORAGE_KEY = "tic-tac-toe:preferences";

const isColor = (v: unknown): v is Color =>
  typeof v === "string" && (AVAILABLE_COLORS as string[]).includes(v);

const isShape = (v: unknown): v is SymbolShape =>
  typeof v === "string" && (AVAILABLE_SHAPES as string[]).includes(v);

/** A shape saved by an older build, mapped to the one that replaced it. */
const readShape = (v: unknown): SymbolShape | undefined =>
  isShape(v) ? v : typeof v === "string" ? LEGACY_SHAPES[v] : undefined;

const isDifficulty = (v: unknown): v is AI_DifficultyType =>
  typeof v === "string" &&
  (Object.values(AI_Difficulty) as string[]).includes(v);

const isTheme = (v: unknown): v is AppTheme => v === "light" || v === "dark";


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
  if (isTheme(prefs.theme)) out.theme = prefs.theme;
  if (isColor(prefs.color)) out.color = prefs.color;
  const playerShape = readShape(prefs.playerShape);
  if (playerShape) out.playerShape = playerShape;
  if (isColor(prefs.opponentColor)) out.opponentColor = prefs.opponentColor;
  const opponentShape = readShape(prefs.opponentShape);
  if (opponentShape) out.opponentShape = opponentShape;
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
