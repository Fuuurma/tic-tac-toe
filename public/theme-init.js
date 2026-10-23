(() => {
  let theme = "light";

  try {
    const stored = localStorage.getItem("tic-tac-toe:preferences");
    const preferences = stored ? JSON.parse(stored) : null;
    if (preferences?.theme === "dark" || preferences?.theme === "light") {
      theme = preferences.theme;
    }
  } catch {
    // Private browsing or blocked storage falls back to the light default.
  }

  document.documentElement.dataset.theme = theme;
  const themeColor = document.querySelector('meta[name="theme-color"]');
  if (themeColor) themeColor.content = theme === "dark" ? "#152028" : "#f8fafb";
})();
