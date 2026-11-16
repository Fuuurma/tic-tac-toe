(() => {
  let theme = null;

  try {
    const stored = localStorage.getItem("tic-tac-toe:preferences");
    const preferences = stored ? JSON.parse(stored) : null;
    if (preferences?.theme === "dark" || preferences?.theme === "light") {
      theme = preferences.theme;
    }
  } catch {
    // Private browsing or blocked storage leaves theme unset, so the
    // system preference below still applies.
  }

  // No saved choice means follow the OS, so a dark-mode first-time visitor
  // gets dark on the very first paint instead of a light flash. An explicit
  // pick in Settings is the only thing that overrides it.
  if (theme === null) {
    theme =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
  }

  document.documentElement.dataset.theme = theme;
  const themeColor = document.querySelector('meta[name="theme-color"]');
  if (themeColor) themeColor.content = theme === "dark" ? "#152028" : "#f8fafb";
})();
