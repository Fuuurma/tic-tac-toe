import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_HANDSHAKE_TIMEOUT_MS, RoomClient } from "./room";

/**
 * F151: a socket that dies before `welcome` means the relay rejected or
 * is unreachable — auto-reconnect must only run for drops of an
 * ESTABLISHED session, never on the initial connect, or the terminal
 * error state is overwritten by an endless "reconnecting" loop.
 */

class FakeSocket {
  static readonly OPEN = 1;
  static readonly CLOSED = 3;
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
    this.readyState = FakeSocket.CLOSED;
    this.emit("close");
  }

  emit(type: string, event?: unknown): void {
    if (type === "open") this.readyState = FakeSocket.OPEN;
    for (const fn of this.handlers.get(type) ?? []) fn(event ?? {});
  }
}

/** The client's default handshake bound; tests assert against the real value. */
const HANDSHAKE_TIMEOUT_MS = DEFAULT_HANDSHAKE_TIMEOUT_MS;

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

  it("auto-reconnects when an established session errors before close", async () => {
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

    // Per the WebSocket spec an `error` is always followed by `close`.
    // The error must not consume the attempt the close handler needs
    // to reach F151 auto-reconnect (work:690).
    ws.emit("error");
    ws.close();
    expect(statuses).toContain("reconnecting");
    client.close();
  });

  it("a pre-welcome error followed by close stays terminal", async () => {
    vi.stubGlobal("WebSocket", FakeSocket);
    const statuses: string[] = [];
    const client = makeClient(statuses);

    const pending = client.connect();
    const ws = FakeSocket.instances[0];
    ws.emit("error");
    ws.close();
    await expect(pending).rejects.toThrow("socket error");

    expect(statuses).not.toContain("reconnecting");
    expect(FakeSocket.instances).toHaveLength(1);
  });
});

/**
 * F460: before this, a socket that stayed CONNECTING — or opened and never
 * received `welcome` — left `connect()` pending forever. F151 correctly
 * refuses to retry a failed *initial* session, but it supplied no finite
 * handshake bound, so the caller had no terminal error to show and an
 * established-session reconnect could never progress.
 */
describe("RoomClient handshake deadline (F460)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    FakeSocket.instances = [];
    vi.useRealTimers();
  });

  it("settles and closes the socket when it never opens", async () => {
    vi.stubGlobal("WebSocket", FakeSocket);
    vi.useFakeTimers();
    const statuses: string[] = [];
    const client = makeClient(statuses);

    const pending = client.connect();
    // Attach the rejection handler BEFORE the clock runs: the deadline
    // rejects synchronously inside the timer, and a handler attached only
    // after `await` would be a microtask too late (unhandled rejection).
    const settled = expect(pending).rejects.toThrow(/timed out/i);
    await vi.advanceTimersByTimeAsync(HANDSHAKE_TIMEOUT_MS + 1);
    await settled;

    // The stale, never-opened socket is closed, not left dangling.
    expect(FakeSocket.instances[0].readyState).toBe(FakeSocket.CLOSED);
    expect(statuses).not.toContain("reconnecting");
    expect(statuses.at(-1)).toBe("disconnected");
    expect(FakeSocket.instances).toHaveLength(1);
  });

  it("settles and closes the socket when it opens without a welcome", async () => {
    vi.stubGlobal("WebSocket", FakeSocket);
    vi.useFakeTimers();
    const statuses: string[] = [];
    const client = makeClient(statuses);

    const pending = client.connect();
    const settled = expect(pending).rejects.toThrow(/timed out/i);
    const ws = FakeSocket.instances[0];
    ws.emit("open");
    await vi.advanceTimersByTimeAsync(HANDSHAKE_TIMEOUT_MS + 1);
    await settled;

    expect(ws.readyState).toBe(FakeSocket.CLOSED);
    expect(client.isConnected()).toBe(false);
    expect(statuses.at(-1)).toBe("disconnected");
  });

  it("settles a close racing the deadline exactly once", async () => {
    vi.stubGlobal("WebSocket", FakeSocket);
    vi.useFakeTimers();
    const statuses: string[] = [];
    const client = makeClient(statuses);

    const pending = client.connect();
    const settled = expect(pending).rejects.toThrow();
    const ws = FakeSocket.instances[0];
    // The relay's `close` lands in the same tick the deadline would fire.
    setTimeout(() => ws.close(), HANDSHAKE_TIMEOUT_MS);
    await vi.advanceTimersByTimeAsync(HANDSHAKE_TIMEOUT_MS + 1);
    await settled;

    // One terminal status, not one per racing path.
    expect(statuses.filter((s) => s === "disconnected")).toHaveLength(1);
    expect(FakeSocket.instances).toHaveLength(1);
  });

  it("ignores a welcome that arrives after the deadline settled", async () => {
    vi.stubGlobal("WebSocket", FakeSocket);
    vi.useFakeTimers();
    const statuses: string[] = [];
    const client = makeClient(statuses);
    const messages: unknown[] = [];
    client.setMessageHandler((msg) => messages.push(msg));

    const pending = client.connect();
    const settled = expect(pending).rejects.toThrow(/timed out/i);
    const ws = FakeSocket.instances[0];
    ws.emit("open");
    await vi.advanceTimersByTimeAsync(HANDSHAKE_TIMEOUT_MS + 1);
    await settled;

    // A late `welcome` must not resurrect a socket we already gave up on:
    // the UI would show "connected" with no live connection.
    ws.emit("message", {
      data: JSON.stringify({ opponent: null, role: "guest", type: "welcome" }),
    });
    expect(messages).toHaveLength(0);
    expect(statuses).not.toContain("connected");
    expect(client.getRole()).toBeNull();
    expect(client.isConnected()).toBe(false);
  });

  it("resumes bounded retry after a timed-out reconnect of an established session", async () => {
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

    // Established session drops and the retry never completes its handshake.
    ws.close();
    await vi.advanceTimersByTimeAsync(2_000);
    const retry = FakeSocket.instances[1];
    retry.emit("open");
    await vi.advanceTimersByTimeAsync(HANDSHAKE_TIMEOUT_MS + 1);

    // The timed-out reconnect must not strand the loop: the next attempt is
    // scheduled instead of the client sitting silent forever.
    await vi.advanceTimersByTimeAsync(30_000);
    expect(FakeSocket.instances.length).toBeGreaterThan(2);
    expect(statuses.filter((s) => s === "reconnecting").length).toBeGreaterThan(1);
    client.close();
  });
});

/**
 * F37: reconnectNow() used to call openSocket() directly, bypassing the
 * pendingConnect dedup that guards connect() — a retry pressed while an
 * attempt was still CONNECTING spawned a parallel WebSocket, and the two
 * attempts raced `this.ws`. The fix funnels every socket-entry path
 * through the same dedup, so an in-flight attempt already IS "reconnect
 * now".
 */
describe("RoomClient in-flight reconnect dedup (F37)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    FakeSocket.instances = [];
    vi.useRealTimers();
  });

  it("reconnectNow during a CONNECTING connect() does not open a second socket", async () => {
    vi.stubGlobal("WebSocket", FakeSocket);
    const statuses: string[] = [];
    const client = makeClient(statuses);

    const pending = client.connect();
    client.reconnectNow();
    client.reconnectNow();
    expect(FakeSocket.instances).toHaveLength(1);

    // Dedup must not wedge the attempt — it still completes normally.
    const ws = FakeSocket.instances[0];
    ws.emit("open");
    ws.emit("message", {
      data: JSON.stringify({ opponent: null, role: "guest", type: "welcome" }),
    });
    await expect(pending).resolves.toMatchObject({ role: "guest" });
    client.close();
  });

  it("a reconnectNow mash while a retry attempt is CONNECTING opens one socket", async () => {
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

    // Established session drops; the manual retry opens attempt #2 and it
    // stays CONNECTING — a second press must not spawn #3.
    ws.close();
    client.reconnectNow();
    expect(FakeSocket.instances).toHaveLength(2);
    client.reconnectNow();
    expect(FakeSocket.instances).toHaveLength(2);
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

    const pending = client.connect();
    const ws = FakeSocket.instances[0];
    const sent = captureSent(ws);
    ws.emit("open");
    expect(sent).toHaveLength(1);
    const hello = JSON.parse(sent[0]) as Record<string, unknown>;
    expect(hello.type).toBe("hello");
    expect("reconnectToken" in hello).toBe(false);
    client.close();
    await expect(pending).rejects.toThrow("closed");
  });

  it("echoes the matchmaking slotToken in hello when bound", async () => {
    vi.stubGlobal("WebSocket", FakeSocket);
    stubStorage();
    const client = new RoomClient({
      displayName: "Tester",
      game: "tictactoe",
      guestId: "guest:1",
      role: "guest",
      wsUrl: "ws://relay.test/room/ABCDEF1234567890?game=tictactoe",
      slotToken: "slot-tok-123",
    });

    const pending = client.connect();
    const ws = FakeSocket.instances[0];
    const sent = captureSent(ws);
    ws.emit("open");
    expect(sent).toHaveLength(1);
    const hello = JSON.parse(sent[0]) as Record<string, unknown>;
    expect(hello.slotToken).toBe("slot-tok-123");
    client.close();
    await expect(pending).rejects.toThrow("closed");
  });

  it("omits slotToken from hello when none was issued", async () => {
    vi.stubGlobal("WebSocket", FakeSocket);
    stubStorage();
    const client = makeRoomClient();

    const pending = client.connect();
    const ws = FakeSocket.instances[0];
    const sent = captureSent(ws);
    ws.emit("open");
    const hello = JSON.parse(sent[0]) as Record<string, unknown>;
    expect("slotToken" in hello).toBe(false);
    client.close();
    await expect(pending).rejects.toThrow("closed");
  });

  it("a late-bound slotToken rides the next hello", async () => {
    // The host's socket opens before its match is disclosed, so its join
    // capability arrives via setSlotToken — it must ride every hello from
    // then on, including reconnects.
    vi.stubGlobal("WebSocket", FakeSocket);
    stubStorage();
    const client = makeRoomClient();
    client.setSlotToken("late-token");

    const pending = client.connect();
    const ws = FakeSocket.instances[0];
    const sent = captureSent(ws);
    ws.emit("open");
    const hello = JSON.parse(sent[0]) as Record<string, unknown>;
    expect(hello.slotToken).toBe("late-token");
    client.close();
    await expect(pending).rejects.toThrow("closed");
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
    const pending = client.connect();
    const ws = FakeSocket.instances[0];
    const sent = captureSent(ws);
    ws.emit("open");
    const hello = JSON.parse(sent[0]) as Record<string, unknown>;
    expect(hello.reconnectToken).toBe("tok-persisted");
    client.close();
    await expect(pending).rejects.toThrow("closed");
  });
});
