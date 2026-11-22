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
 * The consolidation decision (four byte-identical copies became this one
 * shared guard) is recorded in docs/adr/0001-shared-localstorage-guard.md.
 */
export function getBrowserStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
