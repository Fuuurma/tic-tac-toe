import type { BrowserContext, Page } from "@playwright/test";

/** Mirrors ONBOARDING_STORAGE_KEY in src/lib/onboarding.ts. */
const ONBOARDING_KEY = "tic-tac-toe:onboarding";

/**
 * Marks the first-run tour as already seen. A fresh browser context holds no
 * data, which is exactly what onboarding greets, so every spec that is about
 * the lobby or the game starts here. Only onboarding.spec.ts opts out.
 */
export async function skipOnboarding(target: Page | BrowserContext): Promise<void> {
  await target.addInitScript((key) => {
    try {
      window.localStorage.setItem(key, "skipped");
    } catch {
      // Storage blocked: the app then skips onboarding on its own.
    }
  }, ONBOARDING_KEY);
}
