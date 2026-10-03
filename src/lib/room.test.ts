import { afterEach, describe, expect, it, vi } from "vitest";
import { RoomClient } from "./room";

/**
 * F151: a socket that dies before `welcome` means the relay rejected or
 * is unreachable — auto-reconnect must only run for drops of an
 * ESTABLISHED session, never on the initial connect, or the terminal
 * error state is overwritten by an endless "reconnecting" loop.
 */

class FakeSocket {
  static readonly OPEN = 1;
  static instances: FakeSocket[] = [];
  readyState = 0;
  readonly url: string;
  private readonly handlers = new Map<string, Array<(event?: unknown) => void>>();

  constructor(url: string) {
    this.url = url;
    FakeSocket.instances.push(this);
  }

  addEventListener(type: string, fn: (event?: unknown) => void): void {
    const list = this.handlers.get(type) ?? [];
    list.push(fn);
    this.handlers.set(type, list);
  }

  send(): void {}
  close(): void {
    this.readyState = 3;
    this.emit("close");
  }

  emit(type: string, event?: unknown): void {
    if (type === "open") this.readyState = FakeSocket.OPEN;
    for (const fn of this.handlers.get(type) ?? []) fn(event ?? {});
  }
}

function makeClient(statuses: string[]): RoomClient {
  const client = new RoomClient({
    displayName: "Tester",
    game: "tictactoe",
    guestId: "guest:1",
    role: "guest",
    wsUrl: "ws://relay.test/room",
  });
  client.setStatusHandler((status) => statuses.push(status));
  return client;
}

describe("RoomClient reconnect gating (F151)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    FakeSocket.instances = [];
    vi.useRealTimers();
  });

  it("does not auto-reconnect when the initial socket dies before welcome", async () => {
    vi.stubGlobal("WebSocket", FakeSocket);
    const statuses: string[] = [];
    const client = makeClient(statuses);

    const pending = client.connect();
    FakeSocket.instances[0].close();
    await expect(pending).rejects.toThrow("socket closed before welcome");

    expect(statuses).not.toContain("reconnecting");
    expect(statuses.at(-1)).toBe("disconnected");
    expect(FakeSocket.instances).toHaveLength(1);
  });

  it("F253: a pre-welcome relay error frame becomes the rejection reason", async () => {
    vi.stubGlobal("WebSocket", FakeSocket);
    const statuses: string[] = [];
    const client = makeClient(statuses);

    const pending = client.connect();
    const ws = FakeSocket.instances[0];
    ws.emit("message", {
      data: JSON.stringify({
        code: "room-full",
        message: "Room is full",
        type: "error",
      }),
    });
    ws.close();

    // The DO's actionable reason must reach the caller — not the generic
    // "socket closed before welcome" that used to clobber it.
    await expect(pending).rejects.toThrow("Room is full");
    expect(statuses.at(-1)).toBe("disconnected");
  });

  it("auto-reconnects when an established session drops", async () => {
    vi.stubGlobal("WebSocket", FakeSocket);
    vi.useFakeTimers();
    const statuses: string[] = [];
    const client = makeClient(statuses);

    const pending = client.connect();
    const ws = FakeSocket.instances[0];
    ws.emit("open");
    ws.emit("message", {
      data: JSON.stringify({ opponent: null, role: "guest", type: "welcome" }),
    });
    await expect(pending).resolves.toMatchObject({ role: "guest" });

    ws.close();
    expect(statuses).toContain("reconnecting");
    client.close();
  });
});

describe("RoomClient reconnect credential (MM-01)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    FakeSocket.instances = [];
    vi.useRealTimers();
  });

  function stubStorage() {
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    });
    return store;
  }

  function captureSent(ws: FakeSocket): string[] {
    const sent: string[] = [];
    (ws as unknown as { send(data: string): void }).send = (data: string) => {
      sent.push(data);
    };
    return sent;
  }

  function makeRoomClient() {
    return new RoomClient({
      displayName: "Tester",
      game: "tictactoe",
      guestId: "guest:1",
      role: "guest",
      wsUrl: "ws://relay.test/room/ABCDEF1234567890?game=tictactoe",
    });
  }

  it("omits reconnectToken from hello when none is retained", async () => {
    vi.stubGlobal("WebSocket", FakeSocket);
    stubStorage();
    const client = makeRoomClient();

    void client.connect();
    const ws = FakeSocket.instances[0];
    const sent = captureSent(ws);
    ws.emit("open");
    expect(sent).toHaveLength(1);
    const hello = JSON.parse(sent[0]) as Record<string, unknown>;
    expect(hello.type).toBe("hello");
    expect("reconnectToken" in hello).toBe(false);
    client.close();
  });

  it("retains the welcome credential and sends it on reconnect", async () => {
    vi.stubGlobal("WebSocket", FakeSocket);
    vi.useFakeTimers();
    const store = stubStorage();
    const client = makeRoomClient();

    const pending = client.connect();
    const ws = FakeSocket.instances[0];
    ws.emit("open");
    ws.emit("message", {
      data: JSON.stringify({
        opponent: null,
        reconnectToken: "tok-abc-123",
        role: "guest",
        type: "welcome",
      }),
    });
    await expect(pending).resolves.toMatchObject({ role: "guest" });
    expect(store.get("tictactoe:room-token:ABCDEF1234567890")).toBe("tok-abc-123");

    ws.close();
    await vi.advanceTimersByTimeAsync(2000);
    expect(FakeSocket.instances).toHaveLength(2);
    const ws2 = FakeSocket.instances[1];
    const sent2 = captureSent(ws2);
    ws2.emit("open");
    expect(sent2).toHaveLength(1);
    const hello2 = JSON.parse(sent2[0]) as Record<string, unknown>;
    expect(hello2.reconnectToken).toBe("tok-abc-123");
    client.close();
  });

  it("a fresh client instance reclaims with the persisted credential", async () => {
    vi.stubGlobal("WebSocket", FakeSocket);
    const store = stubStorage();
    store.set("tictactoe:room-token:ABCDEF1234567890", "tok-persisted");

    const client = makeRoomClient();
    void client.connect();
    const ws = FakeSocket.instances[0];
    const sent = captureSent(ws);
    ws.emit("open");
    const hello = JSON.parse(sent[0]) as Record<string, unknown>;
    expect(hello.reconnectToken).toBe("tok-persisted");
    client.close();
  });
});
