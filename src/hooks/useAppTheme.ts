import { useCallback, useEffect, useState } from "react";
import { loadPreferences, savePreferences, type AppTheme } from "@/lib/preferences";

const THEME_COLORS: Record<AppTheme, string> = {
  light: "#f8fafb",
  dark: "#152028",
};

function getInitialTheme(): AppTheme {
  const savedTheme = loadPreferences().theme;
  if (savedTheme) return savedTheme;

  // No saved choice: theme-init.js has already stamped the OS preference on
  // <html> before first paint, but resolve it here too so the hook agrees
  // even when that script never ran (blocked, test DOM).
  if (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  ) {
    return "dark";
  }

  if (typeof document === "undefined") return "light";
  const documentTheme = document.documentElement.dataset.theme;
  return documentTheme === "dark" ? "dark" : "light";
}

function applyTheme(theme: AppTheme) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.theme = theme;
  const themeColor = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (themeColor) themeColor.content = THEME_COLORS[theme];
}

export function useAppTheme() {
  const [theme, setThemeState] = useState<AppTheme>(getInitialTheme);

  // theme-init.js owns first paint; this only repairs the stamp when that
  // script never ran (blocked, test DOM) and the resolved theme disagrees.
  useEffect(() => {
    if (typeof document !== "undefined" && document.documentElement.dataset.theme !== theme) {
      applyTheme(theme);
    }
  }, [theme]);

  const setTheme = useCallback((nextTheme: AppTheme) => {
    setThemeState(nextTheme);
    applyTheme(nextTheme);
    savePreferences({ theme: nextTheme });
  }, []);

  return { theme, setTheme };
}
