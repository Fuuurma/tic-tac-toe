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
