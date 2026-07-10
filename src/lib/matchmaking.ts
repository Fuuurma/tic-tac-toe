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
