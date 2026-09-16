import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * The preview bundle bakes VITE_MATCHMAKING_URL at build time — an explicit
 * env override wins, otherwise an untracked local .env.production. Probe the
 * same URL the bundle will actually call so the reachability gate tracks
 * reality instead of a hardcoded default.
 */
function envProductionMatchmakingUrl(): string | undefined {
  try {
    const envFile = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "..", ".env.production"),
      "utf8",
    );
    return envFile.match(/^VITE_MATCHMAKING_URL=(\S+)/m)?.[1];
  } catch {
    return undefined;
  }
}

export const MATCHMAKING_URL =
  process.env.VITE_MATCHMAKING_URL ??
  envProductionMatchmakingUrl() ??
  "http://127.0.0.1:8787";

/**
 * Online specs depend on the matchmaking Worker — a deployed target via
 * E2E_BASE_URL, the production URL baked from the build environment, or a
 * local sibling `wrangler dev` on :8787. HEAD-probe it so the specs skip cleanly
 * instead of failing on connection refused.
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
