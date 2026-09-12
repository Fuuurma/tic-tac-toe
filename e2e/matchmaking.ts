export const MATCHMAKING_URL =
  process.env.VITE_MATCHMAKING_URL ?? "http://127.0.0.1:8787";

/**
 * Online specs depend on the matchmaking Worker — a deployed target via
 * E2E_BASE_URL, or a local sibling `wrangler dev` on :8787. HEAD-probe it
 * so the specs skip cleanly instead of failing on connection refused.
 */
export async function matchmakingReachable(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3_000);
    const res = await fetch(MATCHMAKING_URL, {
      method: "HEAD",
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return res.status < 500;
  } catch {
    return false;
  }
}

/** True when this environment can run online specs. */
export async function onlineSmokeEnabled(): Promise<boolean> {
  return Boolean(process.env.E2E_BASE_URL) || (await matchmakingReachable());
}
