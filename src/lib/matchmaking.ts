export type Match = {
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
   * the client should bypass PeerJS and open this URL directly.
   */
  wsUrl?: string;
};

export type MatchmakingResponse =
  | { status: "waiting"; ticket: string; roomId: string }
  | { status: "matched"; match: Match };

export interface FindMatchOptions {
  game: string;
  peerId: string;
  displayName: string;
  guestId: string;
  baseUrl?: string;
}

const MATCHMAKING_BASE_URL =
  import.meta.env.VITE_MATCHMAKING_URL ?? "http://localhost:8787";

export async function findMatch(options: FindMatchOptions): Promise<MatchmakingResponse> {
  const response = await fetch(
    `${options.baseUrl ?? MATCHMAKING_BASE_URL}/api/matchmaking/${options.game}/join`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        peerId: options.peerId,
        displayName: options.displayName,
        guestId: options.guestId,
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`Matchmaking join failed: ${response.status} ${await response.text()}`);
  }

  return response.json() as Promise<MatchmakingResponse>;
}

export async function pollMatch(
  game: string,
  ticket: string,
  baseUrl: string = MATCHMAKING_BASE_URL,
): Promise<MatchmakingResponse> {
  const response = await fetch(
    `${baseUrl}/api/matchmaking/${game}/poll?ticket=${encodeURIComponent(ticket)}`,
    { method: "GET" },
  );

  if (!response.ok) {
    throw new Error(`Matchmaking poll failed: ${response.status} ${await response.text()}`);
  }

  return response.json() as Promise<MatchmakingResponse>;
}

export async function leaveMatch(
  game: string,
  ticket: string,
  baseUrl: string = MATCHMAKING_BASE_URL,
): Promise<void> {
  await fetch(`${baseUrl}/api/matchmaking/${game}/leave`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ticket }),
  });
}

/**
 * Build a WebSocket URL for the given room when the matchmaking service
 * uses the Cloudflare Durable Object relay (VITE_USE_WS_ROOM build).
 *
 * Used as a fallback when the matchmaking response doesn't pre-include
 * `match.wsUrl` — typically the host (a "waiting" response from matchmaking).
 */
export function buildRoomWsUrl(
  roomId: string,
  game: string,
  baseUrl: string = MATCHMAKING_BASE_URL,
): string {
  const httpUrl = new URL(`/room/${roomId}`, baseUrl);
  httpUrl.searchParams.set("game", game);
  const wsUrl = new URL(httpUrl.toString());
  wsUrl.protocol = wsUrl.protocol === "https:" ? "wss:" : "ws:";
  return wsUrl.toString();
}
