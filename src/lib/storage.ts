/**
 * localStorage, or null where it cannot be used.
 *
 * Two environments have to survive here, and both are load-bearing:
 *
 * - There is no `window` during the build/SSR pass, so touching storage would
 *   throw at module scope.
 * - A browser in private mode, or one where storage is disabled by policy,
 *   throws from the `window.localStorage` accessor itself — not from a later
 *   read — so the accessor has to be inside the try.
 *
 * This guard was written out byte-identically in four modules (identity,
 * preferences, onboarding, i18n/language). Every caller treats `null` as "do
 * not persist", which is why one shared answer is safe: the difference between
 * the four copies could only ever be a bug in one of them.
 */
export function getBrowserStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
