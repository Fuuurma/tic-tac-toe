/**
 * RoomClient — durable-object WebSocket relay client for two-player rooms.
 *
 * Replaces PeerJS as the online transport. The server is the
 * `GameRoomDO` Durable Object in the `fuurma-matchmaking` Worker; it
 * relays well-formed `{ type, ... }` envelopes between two connected
 * sockets and handles hello/peer-joined/peer-left book-keeping.
 *
 * Lifecycle:
 *  - `connect()` opens a WebSocket and resolves once the server sends
 *    `welcome` (after the client sends `hello`).
 *  - On disconnect, the client auto-reconnects with exponential backoff
 *    (capped at 15s), re-sends `hello`, and re-resolves with a fresh
 *    `welcome`. The DO reassigns the same role because the same
 *    `guestId` reconnects.
 *  - `close()` shuts down permanently (no reconnect).
 *
 * Spec: newProjectsPlanner/migrations/2026-07-games-do-websocket-migration.md
 */

export type RoomMessage = { type: string; [key: string]: unknown };

export type RoomRole = "host" | "guest";

export interface WelcomeMessage {
  type: "welcome";
  role: RoomRole;
  opponent: { guestId: string; displayName: string } | null;
}

export interface PeerJoinedMessage {
  type: "peer-joined";
  opponent: { guestId: string; displayName: string };
}

export interface PeerLeftMessage {
  type: "peer-left";
  reason: "disconnect" | "closed";
}

export interface ErrorMessage {
  type: "error";
  code: string;
  message: string;
}

export type RoomEnvelope =
  | WelcomeMessage
  | PeerJoinedMessage
  | PeerLeftMessage
  | ErrorMessage
  | ({ type: string } & Record<string, unknown>);

export type RoomStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "disconnected"
  | "error";

export interface RoomClientOptions {
  wsUrl: string;
  game: string;
  guestId: string;
  displayName: string;
  role?: "host" | "guest";
  protocol?: string;
  maxBackoffMs?: number;
}

export interface RoomSession {
  role: RoomRole;
  opponent: { guestId: string; displayName: string } | null;
}

const DEFAULT_MAX_BACKOFF_MS = 15_000;

export class RoomClient {
  private readonly opts: Required<Omit<RoomClientOptions, "protocol" | "role">> & {
    protocol: string;
    maxBackoffMs: number;
    role: RoomRole | null;
  };

  private ws: WebSocket | null = null;
  private status: RoomStatus = "idle";
  private role: RoomRole | null = null;
  private opponent: { guestId: string; displayName: string } | null = null;
  private closedByUser = false;
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private welcomeResolvers: Array<(value: RoomSession) => void> = [];
  private welcomeRejecters: Array<(reason: Error) => void> = [];

  private messageHandler: ((msg: RoomEnvelope) => void) | null = null;
  private statusHandler: ((status: RoomStatus, detail?: string) => void) | null =
    null;

  constructor(opts: RoomClientOptions) {
    this.opts = {
      wsUrl: opts.wsUrl,
      game: opts.game,
      guestId: opts.guestId,
      displayName: opts.displayName,
      role: opts.role ?? null,
      protocol: opts.protocol ?? "tictactoe:v1",
      maxBackoffMs: opts.maxBackoffMs ?? DEFAULT_MAX_BACKOFF_MS,
    };
  }

  setMessageHandler(handler: (msg: RoomEnvelope) => void): void {
    this.messageHandler = handler;
  }

  setStatusHandler(handler: (status: RoomStatus, detail?: string) => void): void {
    this.statusHandler = handler;
  }

  getStatus(): RoomStatus {
    return this.status;
  }

  getRole(): RoomRole | null {
    return this.role;
  }

  isConnected(): boolean {
    return this.status === "connected" && this.ws?.readyState === WebSocket.OPEN;
  }

  async connect(): Promise<RoomSession> {
    this.closedByUser = false;
    if (this.status === "connected" && this.role) {
      return { role: this.role, opponent: this.opponent };
    }
    return this.openSocket();
  }

  send(message: RoomMessage): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return false;
    try {
      this.ws.send(JSON.stringify({ ...message, protocol: this.opts.protocol }));
      return true;
    } catch {
      return false;
    }
  }

  /** Send a wire message without the protocol envelope (used for `hello`). */
  private sendRaw(message: RoomMessage): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return false;
    try {
      this.ws.send(JSON.stringify(message));
      return true;
    } catch {
      return false;
    }
  }

  close(): void {
    this.closedByUser = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      try {
        this.ws.close(1000, "client closing");
      } catch {
        /* ignore */
      }
      this.ws = null;
    }
    this.setStatus("disconnected", "You left");
    for (const reject of this.welcomeRejecters) {
      reject(new Error("closed"));
    }
    this.welcomeRejecters = [];
    this.welcomeResolvers = [];
  }

  private openSocket(): Promise<RoomSession> {
    return new Promise<RoomSession>((resolve, reject) => {
      this.setStatus(this.status === "reconnecting" ? "reconnecting" : "connecting");
      const url = new URL(this.opts.wsUrl);
      url.searchParams.set("game", this.opts.game);
      let ws: WebSocket;
      try {
        ws = new WebSocket(url.toString());
      } catch (err) {
        reject(err instanceof Error ? err : new Error("websocket construction failed"));
        this.scheduleReconnect();
        return;
      }
      this.ws = ws;

      const settleWelcome = (session: RoomSession | null, error: Error | null) => {
        const resolvers = this.welcomeResolvers;
        const rejecters = this.welcomeRejecters;
        this.welcomeResolvers = [];
        this.welcomeRejecters = [];
        if (session) {
          for (const r of resolvers) r(session);
        }
        if (error) {
          for (const r of rejecters) r(error);
        }
      };

      ws.addEventListener("open", () => {
        // Once a new socket is open, every pending `connect()` call awaits a
        // fresh `welcome` from the server.
        const sent = this.sendRaw({
          type: "hello",
          guestId: this.opts.guestId,
          displayName: this.opts.displayName,
          role: this.role ?? this.opts.role ?? undefined,
        });
        if (!sent) {
          settleWelcome(null, new Error("hello send failed"));
          ws.close();
        }
      });

      ws.addEventListener("message", (event: MessageEvent<string>) => {
        const parsed = parseEnvelope(event.data);
        if (!parsed) return;
        if (parsed.type === "welcome") {
          const welcome = parsed as WelcomeMessage;
          this.role = welcome.role;
          this.opponent = welcome.opponent;
          this.reconnectAttempt = 0;
          this.setStatus("connected");
          const session: RoomSession = { role: welcome.role, opponent: welcome.opponent };
          // Resolve any pending `connect()` call.
          if (this.welcomeResolvers.length > 0) {
            for (const r of this.welcomeResolvers) r(session);
            this.welcomeResolvers = [];
            this.welcomeRejecters = [];
          } else {
            // No pending connect — emit a synthetic welcome so the hook
            // knows we reconnected.
            this.messageHandler?.({
              type: "welcome",
              role: session.role,
              opponent: session.opponent,
            } satisfies RoomEnvelope);
          }
        }
        this.messageHandler?.(parsed);
      });

      ws.addEventListener("close", () => {
        this.ws = null;
        if (this.closedByUser) {
          this.setStatus("disconnected");
          return;
        }
        settleWelcome(null, new Error("socket closed before welcome"));
        this.scheduleReconnect();
      });

      ws.addEventListener("error", () => {
        settleWelcome(null, new Error("socket error"));
        // close event will follow; reconnect happens there
      });

      this.welcomeResolvers.push(resolve);
      this.welcomeRejecters.push(reject);
    });
  }

  private scheduleReconnect(): void {
    if (this.closedByUser) return;
    if (this.reconnectTimer) return;
    const delay = Math.min(
      this.opts.maxBackoffMs,
      1000 * 2 ** Math.min(this.reconnectAttempt, 4),
    );
    this.reconnectAttempt += 1;
    this.setStatus("reconnecting", `Reconnecting in ${Math.round(delay / 100) / 10}s`);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.openSocket().catch(() => {
        // ignored: reconnect lifecycle handles errors via close + retry
      });
    }, delay);
  }

  private setStatus(status: RoomStatus, detail?: string): void {
    this.status = status;
    this.statusHandler?.(status, detail);
  }
}

function parseEnvelope(raw: string): RoomEnvelope | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const obj = parsed as Record<string, unknown>;
  if (typeof obj.type !== "string") return null;
  return obj as unknown as RoomEnvelope;
}

export type RoomStatusListener = (status: RoomStatus, detail?: string) => void;

export const roomStatusLabel = (status: RoomStatus): string => {
  switch (status) {
    case "idle":
      return "Idle";
    case "connecting":
      return "Connecting...";
    case "connected":
      return "Connected";
    case "reconnecting":
      return "Reconnecting...";
    case "disconnected":
      return "Disconnected";
    case "error":
      return "Error";
  }
};
