import { describe, expect, it } from "vitest";
import type { MessageDataEvent, StorageLike } from "@fuurma/online-client";
import { RoomClient } from "./roomClient";

/** S6: the SDK-backed RoomClient must keep the fork's method surface and
 *  the game's persisted reconnect-token prefix. */

class FakeSocket {
  static instances: FakeSocket[] = [];
  readyState = 0;
  readonly sent: string[] = [];
  private readonly handlers = new Map<string, Array<(event: MessageDataEvent) => void>>();

  constructor(readonly url: string) {
    FakeSocket.instances.push(this);
  }

  addEventListener(type: string, fn: (event: MessageDataEvent) => void): void {
    const list = this.handlers.get(type) ?? [];
    list.push(fn);
    this.handlers.set(type, list);
  }

  send(data: string): void {
    this.sent.push(data);
  }

  close(): void {
    this.readyState = 3;
    this.emit("close");
  }

  emit(type: string, event: MessageDataEvent = {}): void {
    if (type === "open") this.readyState = 1;
    for (const fn of this.handlers.get(type) ?? []) fn(event);
  }
}

function memStorage(seed: Record<string, string> = {}): StorageLike & { map: Map<string, string> } {
  const map = new Map(Object.entries(seed));
  return {
    map,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  };
}

const BASE = {
  displayName: "Tester",
  game: "tictactoe",
  guestId: "guest:1",
  role: "guest" as const,
  wsUrl: "ws://relay.test/room/ABCD",
};

function makeClient(storage = memStorage()) {
  FakeSocket.instances = [];
  return {
    storage,
    client: new RoomClient({
      ...BASE,
      socket: (url: string) => new FakeSocket(url),
      storage,
    }),
  };
}

describe("RoomClient SDK adapter (S6)", () => {
  it("keeps the fork's method surface", () => {
    const { client } = makeClient();
    for (const method of [
      "connect",
      "send",
      "close",
      "closeForReconnect",
      "setMessageHandler",
      "setStatusHandler",
      "setSlotToken",
      "reconnectNow",
      "getStatus",
      "getRole",
      "isConnected",
    ] as const) {
      expect(typeof client[method], method).toBe("function");
    }
  });

  it("echoes a retained tictactoe:room-token: credential in hello", async () => {
    const { client } = makeClient(
      memStorage({ "tictactoe:room-token:ABCD": "tok-1" }),
    );
    const pending = client.connect();
    const ws = FakeSocket.instances[0];
    ws.emit("open");
    const hello = JSON.parse(ws.sent[0]) as Record<string, unknown>;
    expect(hello).toMatchObject({ type: "hello", reconnectToken: "tok-1" });
    ws.emit("message", {
      data: JSON.stringify({ opponent: null, role: "guest", type: "welcome" }),
    });
    await expect(pending).resolves.toMatchObject({ role: "guest" });
    client.close();
  });

  it("persists the welcome reconnectToken under the game's prefix", async () => {
    const { client, storage } = makeClient();
    const pending = client.connect();
    const ws = FakeSocket.instances[0];
    ws.emit("open");
    ws.emit("message", {
      data: JSON.stringify({
        opponent: null,
        reconnectToken: "tok-2",
        role: "guest",
        type: "welcome",
      }),
    });
    await pending;
    expect(storage.map.get("tictactoe:room-token:ABCD")).toBe("tok-2");
    client.close();
  });

  it("rejects connect() with an Error carrying the relay's message", async () => {
    const { client } = makeClient();
    const pending = client.connect();
    const ws = FakeSocket.instances[0];
    ws.emit("message", {
      data: JSON.stringify({ code: "room-full", message: "Room is full", type: "error" }),
    });
    ws.close();
    await expect(pending).rejects.toThrow("Room is full");
  });
});
