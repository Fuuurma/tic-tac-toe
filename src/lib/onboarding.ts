export const ONBOARDING_STORAGE_KEY = "tic-tac-toe:onboarding";

/** How a first run ended. Either value means "do not ask again". */
type OnboardingOutcome = "done" | "skipped";

// Anything the app itself wrote before. Their presence means the visitor has
// played here already (or predates onboarding), so they are not new.
const EXISTING_DATA_PREFIX = "tic-tac-toe:";

const getBrowserStorage = (): Storage | null => {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

/**
 * True only for a visitor we hold no data on: no recorded outcome and nothing
 * else this app has ever stored (guest id, name, preferences, stats).
 *
 * It must be read before anything creates an identity. `getOrCreateGuestIdentity`
 * writes a guest id the moment the lobby mounts, which would turn every new
 * visitor into a returning one.
 *
 * Unavailable or hostile storage answers false: we could not remember the
 * outcome, so asking on every load would be a loop the visitor cannot leave.
 */
export function shouldShowOnboarding(
  storage: Storage | null = getBrowserStorage(),
): boolean {
  if (!storage) return false;
  try {
    for (let i = 0; i < storage.length; i += 1) {
      if (storage.key(i)?.startsWith(EXISTING_DATA_PREFIX)) return false;
    }
    return true;
  } catch {
    return false;
  }
}

export function recordOnboardingOutcome(
  outcome: OnboardingOutcome,
  storage: Storage | null = getBrowserStorage(),
): void {
  if (!storage) return;
  try {
    storage.setItem(ONBOARDING_STORAGE_KEY, outcome);
  } catch {
    // QuotaExceededError / SecurityError: best-effort, like preferences.
  }
}
