import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RoomClient } from "@/lib/room";

type Listener = (event?: { data?: string }) => void;

class FakeWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;
  static instances: FakeWebSocket[] = [];
  static throwOnConstruct = false;

  readonly url: string;
  readyState = FakeWebSocket.CONNECTING;
  readonly sent: string[] = [];
  private readonly listeners = new Map<string, Listener[]>();

  constructor(url: string) {
    if (FakeWebSocket.throwOnConstruct) {
      FakeWebSocket.throwOnConstruct = false;
      throw new Error("websocket construction failed");
    }
    this.url = url;
    FakeWebSocket.instances.push(this);
  }

  addEventListener(type: string, listener: Listener): void {
    const existing = this.listeners.get(type) ?? [];
    existing.push(listener);
    this.listeners.set(type, existing);
  }

  send(payload: string): void {
    this.sent.push(payload);
  }

  close(): void {
    this.readyState = FakeWebSocket.CLOSED;
    this.emit("close");
  }

  open(): void {
    this.readyState = FakeWebSocket.OPEN;
    this.emit("open");
  }

  welcome(role: "host" | "guest" = "host"): void {
    this.emit("message", {
      data: JSON.stringify({ type: "welcome", role, opponent: null }),
    });
  }

  private emit(type: string, event?: { data?: string }): void {
    for (const listener of this.listeners.get(type) ?? []) {
      listener(event);
    }
  }
}

function lastSocket(): FakeWebSocket {
  const ws = FakeWebSocket.instances.at(-1);
  if (!ws) throw new Error("no FakeWebSocket constructed");
  return ws;
}

function makeClient(): RoomClient {
  return new RoomClient({
    wsUrl: "ws://example.test/room/abc",
    game: "tictactoe",
    guestId: "guest-1",
    displayName: "Ada",
  });
}

describe("RoomClient initial-connect reconnect policy (F151)", () => {
  beforeEach(() => {
    FakeWebSocket.instances = [];
    FakeWebSocket.throwOnConstruct = false;
    vi.stubGlobal("WebSocket", FakeWebSocket);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("does not auto-reconnect when the socket closes before welcome", async () => {
    const client = makeClient();
    const statuses: string[] = [];
    client.setStatusHandler((status) => {
      statuses.push(status);
    });

    const pending = client.connect();
    lastSocket().close();

    await expect(pending).rejects.toThrow(/socket closed before welcome/);
    expect(client.getStatus()).toBe("error");
    expect(statuses).not.toContain("reconnecting");

    await vi.advanceTimersByTimeAsync(30_000);
    expect(FakeWebSocket.instances).toHaveLength(1);
  });

  it("does auto-reconnect after a welcome has established the session", async () => {
    const client = makeClient();
    const statuses: string[] = [];
    client.setStatusHandler((status) => {
      statuses.push(status);
    });

    const pending = client.connect();
    lastSocket().open();
    lastSocket().welcome("host");
    await expect(pending).resolves.toMatchObject({ role: "host" });
    expect(client.getStatus()).toBe("connected");

    lastSocket().close();
    expect(statuses).toContain("reconnecting");
    expect(client.getStatus()).toBe("reconnecting");

    await vi.advanceTimersByTimeAsync(2_000);
    expect(FakeWebSocket.instances.length).toBeGreaterThan(1);
  });

  it("does not schedule reconnect when WebSocket construction fails before welcome", async () => {
    FakeWebSocket.throwOnConstruct = true;
    const client = makeClient();
    const pending = client.connect();
    await expect(pending).rejects.toThrow(/websocket construction failed/);

    await vi.advanceTimersByTimeAsync(30_000);
    expect(FakeWebSocket.instances).toHaveLength(0);
  });

  it("reconnectNow after a failed initial connect tries once and still does not loop", async () => {
    const client = makeClient();
    const pending = client.connect();
    lastSocket().close();
    await expect(pending).rejects.toThrow();

    client.reconnectNow();
    expect(FakeWebSocket.instances).toHaveLength(2);

    lastSocket().close();
    await vi.advanceTimersByTimeAsync(30_000);
    expect(FakeWebSocket.instances).toHaveLength(2);
  });
});
