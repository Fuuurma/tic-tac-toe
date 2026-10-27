import { afterEach, describe, expect, it, vi } from "vitest";
import { isPeerMessage } from "./peer.wire";
import { RoomClient } from "./roomClient";

/**
 * A frame must survive the whole path: RoomClient.send stamps it, the relay
 * forwards it verbatim, and the peer's isPeerMessage admits it. Each half has
 * its own tests; none ran one through the other, which is how the `protocol`
 * stamp and the payload-less-frame gate (F85) ended up refusing each other.
 */

class CapturingSocket {
  static readonly OPEN = 1;
  static readonly CLOSED = 3;
  static instances: CapturingSocket[] = [];
  readyState = 0;
  readonly sent: string[] = [];
  private readonly handlers = new Map<string, Array<(event?: unknown) => void>>();

  constructor(readonly url: string) {
    CapturingSocket.instances.push(this);
  }

  addEventListener(type: string, fn: (event?: unknown) => void): void {
    this.handlers.set(type, [...(this.handlers.get(type) ?? []), fn]);
  }

  send(data: string): void {
    this.sent.push(data);
  }

  close(): void {
    this.readyState = CapturingSocket.CLOSED;
    this.emit("close");
  }

  emit(type: string, event?: unknown): void {
    if (type === "open") this.readyState = CapturingSocket.OPEN;
    for (const fn of this.handlers.get(type) ?? []) fn(event ?? {});
  }
}

async function connectedClient(): Promise<{ client: RoomClient; ws: CapturingSocket }> {
  vi.stubGlobal("WebSocket", CapturingSocket);
  const client = new RoomClient({
    displayName: "Tester",
    game: "tictactoe",
    guestId: "guest:1",
    role: "guest",
    wsUrl: "ws://relay.test/room",
  });
  const pending = client.connect();
  const ws = CapturingSocket.instances[0];
  ws.emit("open");
  ws.emit("message", {
    data: JSON.stringify({ opponent: null, role: "guest", type: "welcome" }),
  });
  await pending;
  return { client, ws };
}

describe("frames sent by RoomClient are accepted by the peer validator", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    CapturingSocket.instances = [];
  });

  it.each(["rematchAccept", "rematchDecline", "rematchCancel", "leave", "sync_request"])(
    "%s",
    async (type) => {
      const { client, ws } = await connectedClient();
      ws.sent.length = 0;

      expect(client.send({ type })).toBe(true);

      expect(isPeerMessage(JSON.parse(ws.sent[0]))).toBe(true);
    },
  );

  it("a move", async () => {
    const { client, ws } = await connectedClient();
    ws.sent.length = 0;

    expect(client.send({ index: 4, type: "move" })).toBe(true);

    expect(isPeerMessage(JSON.parse(ws.sent[0]))).toBe(true);
  });
});
