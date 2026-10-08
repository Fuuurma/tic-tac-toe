type Match = {
  roomId: string;
  role: "host" | "guest";
  host: {
    peerId: string;
    displayName: string;
    guestId: string;
  };
  guest: {
    peerId: string;
    displayName: string;
    guestId: string;
  };
  /**
   * Direct WebSocket URL for the room relay. Only set when the
   * matchmaking service knows the room ID format (in our stack,
   * the Cloudflare Durable Object WebSocket relay). When present,
   * the client should open this URL directly.
   */
  wsUrl?: string;
};

export type MatchmakingResponse =
  | {
      status: "waiting";
      ticket: string;
      roomId: string;
      /**
       * 1-based position in the Worker's FIFO matchmaking queue, reported
       * when the service runs the explicit-queue protocol. Absent on older
       * Worker versions — the searching UI treats `undefined` as "position
       * unknown" rather than zero.
       */
      position?: number;
    }
  | { status: "matched"; match: Match; slotToken?: string };

function isParticipant(value: unknown): value is Match["host"] {
  if (typeof value !== "object" || value === null) return false;
  const p = value as Record<string, unknown>;
  return (
    typeof p.peerId === "string" &&
    typeof p.displayName === "string" &&
    typeof p.guestId === "string"
  );
}

/** The wire is not the type system: a 200 with `{}`, an error body, or a
 *  newer response shape must not flow through as a cast — downstream reads
 *  `response.ticket` (→ `?ticket=undefined` poll loop) and `match.roomId`
 *  (→ crash) verbatim (devin 2026-09-10 finding). */
export function parseMatchmakingResponse(data: unknown): MatchmakingResponse {
  if (typeof data !== "object" || data === null) {
    throw new Error("Malformed matchmaking response: not an object");
  }
  const d = data as Record<string, unknown>;
  if (
    d.status === "waiting" &&
    typeof d.ticket === "string" &&
    typeof d.roomId === "string" &&
    (d.position === undefined ||
      (typeof d.position === "number" &&
        Number.isInteger(d.position) &&
        d.position > 0))
  ) {
    return d.position === undefined
      ? { status: "waiting", ticket: d.ticket, roomId: d.roomId }
      : { status: "waiting", ticket: d.ticket, roomId: d.roomId, position: d.position };
  }
  if (d.status === "matched" && typeof d.match === "object" && d.match !== null) {
    const m = d.match as Record<string, unknown>;
    const { roomId, role, host, guest, wsUrl } = m;
    if (
      typeof roomId === "string" &&
      (role === "host" || role === "guest") &&
      isParticipant(host) &&
      isParticipant(guest) &&
      (wsUrl === undefined || typeof wsUrl === "string")
    ) {
      const slotToken = typeof d.slotToken === "string" ? d.slotToken : undefined;
      return {
        status: "matched",
        match:
          wsUrl === undefined
            ? { roomId, role, host, guest }
            : { roomId, role, host, guest, wsUrl },
        ...(slotToken === undefined ? {} : { slotToken }),
      };
    }
  }
  throw new Error("Malformed matchmaking response: unexpected shape");
}

interface FindMatchOptions {
  game: string;
  peerId: string;
  displayName: string;
  guestId: string;
  baseUrl?: string;
}

const _matchmakingUrl = import.meta.env.VITE_MATCHMAKING_URL;

/**
 * Whether this build can reach a matchmaking backend at all.
 *
 * A production build without `VITE_MATCHMAKING_URL` is a build misconfig,
 * and it used to be enforced with a throw at module scope. That throw was
 * inside the lazily-loaded online chunk, so it escalated to the app-wide
 * ErrorBoundary: one missing variable replaced the whole product, including
 * the single-player games the visitor was playing, with a developer-facing
 * message. The URL is now resolved per call so only online play fails, and
 * only when it is actually used.
 */
export const MATCHMAKING_CONFIGURED = Boolean(_matchmakingUrl);

const MATCHMAKING_BASE_URL =
  _matchmakingUrl ?? "http://127.0.0.1:8787";

/** Thrown when online play is invoked in a build with no backend configured. */
export const MATCHMAKING_UNAVAILABLE_MESSAGE =
  "Online play isn't available in this build.";

const resolveBaseUrl = (override?: string): string => {
  if (override) return override;
  if (!_matchmakingUrl && import.meta.env.PROD) {
    throw new Error(MATCHMAKING_UNAVAILABLE_MESSAGE);
  }
  return MATCHMAKING_BASE_URL;
};

export const MATCH_POLL_INITIAL_DELAY_MS = 1_000;
export const MATCH_POLL_MAX_DELAY_MS = 4_000;

/** Hard fetch timeout — a hung connection must not stall the poll loop. */
export const MATCHMAKING_TIMEOUT_MS = 10_000;
const LEAVE_TIMEOUT_MS = 5_000;

export function getMatchPollDelay(attempt: number): number {
  if (!Number.isInteger(attempt) || attempt < 0) return MATCH_POLL_INITIAL_DELAY_MS;
  return Math.min(
    MATCH_POLL_INITIAL_DELAY_MS * 2 ** attempt,
    MATCH_POLL_MAX_DELAY_MS,
  );
}

export async function findMatch(options: FindMatchOptions): Promise<MatchmakingResponse> {
  const response = await fetch(
    `${resolveBaseUrl(options.baseUrl)}/api/matchmaking/${options.game}/join`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        peerId: options.peerId,
        displayName: options.displayName,
        guestId: options.guestId,
      }),
      signal: AbortSignal.timeout(MATCHMAKING_TIMEOUT_MS),
    },
  );

  if (!response.ok) {
    throw new Error(`Matchmaking join failed: ${response.status} ${await response.text()}`);
  }

  return parseMatchmakingResponse(await response.json());
}

export async function pollMatch(
  game: string,
  ticket: string,
  baseUrl?: string,
): Promise<MatchmakingResponse> {
  const response = await fetch(
    `${resolveBaseUrl(baseUrl)}/api/matchmaking/${game}/poll?ticket=${encodeURIComponent(ticket)}`,
    { method: "GET", signal: AbortSignal.timeout(MATCHMAKING_TIMEOUT_MS) },
  );

  if (!response.ok) {
    throw new Error(`Matchmaking poll failed: ${response.status} ${await response.text()}`);
  }

  return parseMatchmakingResponse(await response.json());
}

export async function leaveMatch(
  game: string,
  ticket: string,
  baseUrl?: string,
  options?: { keepalive?: boolean },
): Promise<void> {
  const response = await fetch(`${resolveBaseUrl(baseUrl)}/api/matchmaking/${game}/leave`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ticket }),
    signal: AbortSignal.timeout(LEAVE_TIMEOUT_MS),
    // `keepalive` lets the request outlive the page — required for the
    // pagehide cancel-on-disconnect path, where an ordinary fetch is
    // killed with the tab before it reaches the Worker.
    keepalive: options?.keepalive === true,
  });
  if (!response.ok) {
    throw new Error(`Matchmaking leave failed: ${response.status} ${await response.text()}`);
  }
}

/**
 * Build a WebSocket URL for the given room when the matchmaking service
 * uses the Cloudflare Durable Object relay.
 *
 * Used as a fallback when the matchmaking response doesn't pre-include
 * `match.wsUrl` — typically the host (a "waiting" response from matchmaking).
 */
export function buildRoomWsUrl(
  roomId: string,
  baseUrl: string = MATCHMAKING_BASE_URL,
): string {
  // Note: the `game` query param is intentionally NOT set here —
  // RoomClient.openSocket owns it (single writer, devin 09-07 20:05
  // finding 6); a double-set silently overwrote whatever the caller's
  // wsUrl carried.
  const httpUrl = new URL(`/room/${roomId}`, baseUrl);
  const wsUrl = new URL(httpUrl.toString());
  wsUrl.protocol = wsUrl.protocol === "https:" ? "wss:" : "ws:";
  return wsUrl.toString();
}
