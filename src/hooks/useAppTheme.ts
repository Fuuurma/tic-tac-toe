import { useCallback, useState } from "react";
import { loadPreferences, savePreferences, type AppTheme } from "@/lib/preferences";

const THEME_COLORS: Record<AppTheme, string> = {
  light: "#f8fafb",
  dark: "#152028",
};

function getInitialTheme(): AppTheme {
  const savedTheme = loadPreferences().theme;
  if (savedTheme) return savedTheme;

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

  const setTheme = useCallback((nextTheme: AppTheme) => {
    setThemeState(nextTheme);
    applyTheme(nextTheme);
    savePreferences({ theme: nextTheme });
  }, []);

  return { theme, setTheme };
}
