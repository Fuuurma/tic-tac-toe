import { useSyncExternalStore } from "react";
import {
  type AI_Difficulty as AI_DifficultyType,
  type Color,
  type GameMode,
  GameModes,
  type SymbolShape,
} from "@/game/constants";
import type { Locale } from "@/lib/preferences";
import { en, type StringKey } from "./en";
import { es } from "./es";

/**
 * Own storage key, deliberately outside the preferences blob: the
 * onboarding gate treats any stored app data as "returning visitor", and
 * merely picking a language on the welcome screen must not end a first
 * run. The gate skips exactly this key (see lib/onboarding).
 */
export const LANGUAGE_STORAGE_KEY = "tic-tac-toe:language";

const getBrowserStorage = (): Storage | null => {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

const isLocale = (v: unknown): v is Locale => v === "en" || v === "es";

export function loadLanguage(storage: Storage | null = getBrowserStorage()): Locale | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(LANGUAGE_STORAGE_KEY);
    return isLocale(raw) ? raw : null;
  } catch {
    return null;
  }
}

function saveLanguage(locale: Locale, storage: Storage | null = getBrowserStorage()): void {
  if (!storage) return;
  try {
    storage.setItem(LANGUAGE_STORAGE_KEY, locale);
  } catch {
    // Best-effort, like preferences.
  }
}

const dictionaries: Record<Locale, Record<StringKey, string>> = { en, es };

/**
 * The UI language as module-level state, not context — the same shape as
 * the player-count store. Every consumer (components, hooks, protocol
 * code) reads the same value, and switching re-renders subscribers without
 * threading a provider through the lazy online chunk, the error boundary
 * fallback, and three dozen unit tests that render without one.
 */
let current: Locale = "en";
const listeners = new Set<() => void>();

function publish(next: Locale) {
  if (next === current) return;
  current = next;
  for (const listener of [...listeners]) listener();
}

function applyLocale(locale: Locale) {
  if (typeof document !== "undefined") {
    document.documentElement.lang = locale;
  }
}

/** Saved choice wins; otherwise a Spanish browser gets Spanish. */
function initialLocale(): Locale {
  const saved = loadLanguage();
  if (saved) return saved;
  if (typeof navigator !== "undefined" && navigator.language?.toLowerCase().startsWith("es")) {
    return "es";
  }
  return "en";
}

/** Read once at startup (called from main.tsx before first render). */
export function initLocale(): Locale {
  const locale = initialLocale();
  current = locale;
  applyLocale(locale);
  return locale;
}

export function getLocale(): Locale {
  return current;
}

export function setLocale(locale: Locale): void {
  publish(locale);
  applyLocale(locale);
  saveLanguage(locale);
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export function useLocale(): Locale {
  return useSyncExternalStore(subscribe, getLocale, getLocale);
}

export type StringVars = Record<string, string | number>;

/** Look up a key in the current language, English if somehow absent. */
export function t(key: StringKey, vars?: StringVars): string {
  const template = dictionaries[current][key] ?? en[key];
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, name: string) => String(vars[name] ?? ""));
}

/** Bound translator + setter for components. Re-renders on switch. */
export function useStrings(): {
  locale: Locale;
  t: (key: StringKey, vars?: StringVars) => string;
  setLocale: (locale: Locale) => void;
} {
  const locale = useLocale();
  return { locale, t, setLocale };
}

/** Locale-aware label getters. The `*_LABELS` maps in game/constants stay
 * as the English source for non-UI uses; everything rendered goes through
 * these so it follows the switch. */
export function getShapeLabel(shape: SymbolShape): string {
  return t(`shape.${shape.toLowerCase()}` as StringKey);
}

export function getDifficultyLabel(difficulty: AI_DifficultyType): string {
  return t(`difficulty.${difficulty.toLowerCase()}` as StringKey);
}

export function getColorLabel(color: Color): string {
  return t(`color.${color}` as StringKey);
}

export function getModeLabel(mode: GameMode): string {
  if (mode === GameModes.VS_COMPUTER) return t("mode.computer");
  if (mode === GameModes.VS_FRIEND) return t("mode.friend");
  return t("mode.online");
}

export function getModeShortLabel(mode: GameMode): string {
  if (mode === GameModes.VS_COMPUTER) return t("mode.short.computer");
  if (mode === GameModes.VS_FRIEND) return t("mode.short.friend");
  return t("mode.short.online");
}
