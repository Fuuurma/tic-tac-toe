import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RoomClient } from "@/lib/room";

// Regression pins for F151: auto-reconnect must only run when a session
// was established (a `welcome` was received). A failed initial connect()
// has to settle as a terminal error — before the fix, the pre-welcome
// close listener rejected the pending connect AND scheduled a reconnect,
// flipping the caller's "error" status back to "reconnecting" forever.

type Listener = (event?: unknown) => void;

class FakeWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;
  static instances: FakeWebSocket[] = [];

  readyState = FakeWebSocket.CONNECTING;
  readonly sent: string[] = [];
  private readonly listeners = new Map<string, Listener[]>();

  constructor(readonly url: string) {
    FakeWebSocket.instances.push(this);
  }

  addEventListener(type: string, listener: Listener) {
    const list = this.listeners.get(type) ?? [];
    list.push(listener);
    this.listeners.set(type, list);
  }

  send(data: string) {
    this.sent.push(data);
  }

  close() {
    this.readyState = FakeWebSocket.CLOSED;
    this.emit("close");
  }

  emit(type: string, event?: unknown) {
    for (const listener of this.listeners.get(type) ?? []) listener(event);
  }

  serverOpen() {
    this.readyState = FakeWebSocket.OPEN;
    this.emit("open");
  }

  serverMessage(message: unknown) {
    this.emit("message", { data: JSON.stringify(message) });
  }

  serverClose() {
    this.readyState = FakeWebSocket.CLOSED;
    this.emit("close");
  }
}

function makeClient() {
  const client = new RoomClient({
    wsUrl: "wss://relay.test/room",
    game: "tictactoe",
    guestId: "guest-1",
    displayName: "Guest",
  });
  const statuses: string[] = [];
  client.setStatusHandler((status) => statuses.push(status));
  return { client, statuses };
}

describe("RoomClient reconnect gating", () => {
  beforeEach(() => {
    FakeWebSocket.instances = [];
    vi.stubGlobal("WebSocket", FakeWebSocket);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("settles a failed initial connect() as terminal instead of reconnecting forever", async () => {
    const { client, statuses } = makeClient();
    const attempt = client.connect();
    FakeWebSocket.instances[0].serverClose();

    await expect(attempt).rejects.toThrow("socket closed before welcome");
    vi.advanceTimersByTime(120_000);

    expect(statuses).toEqual(["connecting", "disconnected"]);
    expect(FakeWebSocket.instances).toHaveLength(1);
  });

  it("still auto-reconnects after a mid-session drop", async () => {
    const { client, statuses } = makeClient();
    const attempt = client.connect();
    const socket = FakeWebSocket.instances[0];
    socket.serverOpen();
    socket.serverMessage({ type: "welcome", role: "host", opponent: null });

    await expect(attempt).resolves.toEqual({ role: "host", opponent: null });

    socket.serverClose();
    expect(statuses).toContain("reconnecting");
    vi.advanceTimersByTime(60_000);
    expect(FakeWebSocket.instances.length).toBeGreaterThan(1);
    client.close();
  });
});
