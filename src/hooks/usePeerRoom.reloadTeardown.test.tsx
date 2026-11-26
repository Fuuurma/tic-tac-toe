"@vitest-environment jsdom";


import { act, cleanup, render } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Color, GameModes } from "@/game/constants";
import type { RoomClient } from "@/lib/roomClient";
import { reportError } from "@/lib/errorReporting";
import { teardownTransport, usePeerRoom } from "./usePeerRoom";

vi.mock("@/lib/errorReporting", () => ({ reportError: vi.fn() }));

const mockedReportError = vi.mocked(reportError);

const fakeSocket = vi.hoisted(() => {
  type Handler = (msg: never) => void;
  type StatusHandler = (status: string, detail?: string) => void;

  class FakeRoomClient {
    static instances: FakeRoomClient[] = [];

    readonly wsUrl: string;
    readonly role: string;
    sent: unknown[] = [];
    closeCalls = 0;
    closeForReconnectCalls = 0;
    connectCalls = 0;
    messageHandler: Handler | null = null;
    statusHandler: StatusHandler | null = null;
    private rejectPending: ((err: Error) => void) | null = null;

    constructor(opts: { wsUrl: string; role: string }) {
      this.wsUrl = opts.wsUrl;
      this.role = opts.role;
      FakeRoomClient.instances.push(this);
    }

    setMessageHandler(handler: Handler): void {
      this.messageHandler = handler;
    }

    setStatusHandler(handler: StatusHandler): void {
      this.statusHandler = handler;
    }

    send(message: unknown): boolean {
      this.sent.push(message);
      return true;
    }

    close(): void {
      this.closeCalls += 1;
    }

    closeForReconnect(): void {
      this.closeForReconnectCalls += 1;
      this.statusHandler?.("disconnected", "Reconnecting");
      this.rejectPending?.(new Error("closed"));
    }

    connect(): Promise<never> {
      this.connectCalls += 1;
      return new Promise<never>((_resolve, reject) => {
        this.rejectPending = reject;
      });
    }

    reconnectNow(): void {}

    setSlotToken(): void {}

    getStatus(): string {
      return "connecting";
    }

    getRole(): string {
      return this.role;
    }

    isConnected(): boolean {
      return false;
    }
  }

  return { FakeRoomClient };
});

vi.mock("@/lib/roomClient", () => ({ RoomClient: fakeSocket.FakeRoomClient }));

type PeerApi = ReturnType<typeof usePeerRoom>;

function Harness({ apiRef }: { apiRef: { current: PeerApi | null } }) {
  const peer = usePeerRoom({
    hostDisplayName: "Ada",
    hostColor: Color.BLUE,
    gameMode: GameModes.ONLINE,
  });
  useEffect(() => {
    apiRef.current = peer;
  });
  return null;
}

async function joinRoom(apiRef: { current: PeerApi | null }): Promise<void> {
  await act(async () => {
    apiRef.current?.joinAsGuest("ROOM42", "ws://relay.test/room");
  });
}

beforeEach(() => {
  fakeSocket.FakeRoomClient.instances.length = 0;
  mockedReportError.mockClear();
});

afterEach(() => {
  cleanup();
});

describe("passive transport close", () => {
  it("closes with reconnect semantics on unmount, sends no leave frame and never calls close()", async () => {
    const apiRef = { current: null as PeerApi | null };
    const { unmount } = render(<Harness apiRef={apiRef} />);
    await joinRoom(apiRef);
    const client = fakeSocket.FakeRoomClient.instances[0];

    unmount();

    expect(client.closeForReconnectCalls).toBe(1);
    expect(client.closeCalls).toBe(0);
    expect(client.sent).not.toContainEqual({ type: "leave" });
  });

  it("closeTransport closes with reconnect semantics, sends no leave frame and never calls close()", async () => {
    const apiRef = { current: null as PeerApi | null };
    render(<Harness apiRef={apiRef} />);
    await joinRoom(apiRef);
    const client = fakeSocket.FakeRoomClient.instances[0];

    await act(async () => {
      apiRef.current?.closeTransport();
    });

    expect(client.closeForReconnectCalls).toBe(1);
    expect(client.closeCalls).toBe(0);
    expect(client.sent).not.toContainEqual({ type: "leave" });
  });

  it("is idempotent", async () => {
    const apiRef = { current: null as PeerApi | null };
    render(<Harness apiRef={apiRef} />);
    await joinRoom(apiRef);
    const client = fakeSocket.FakeRoomClient.instances[0];

    await act(async () => {
      apiRef.current?.closeTransport();
      apiRef.current?.closeTransport();
    });

    expect(client.closeForReconnectCalls).toBe(1);
  });

  it("never writes a terminal status from the passive close", async () => {
    const apiRef = { current: null as PeerApi | null };
    render(<Harness apiRef={apiRef} />);
    await joinRoom(apiRef);
    expect(apiRef.current?.state.status).toBe("connecting");

    await act(async () => {
      apiRef.current?.closeTransport();
      await Promise.resolve();
    });

    expect(apiRef.current?.state.status).toBe("connecting");
    expect(apiRef.current?.state.status).not.toBe("disconnected");
    expect(apiRef.current?.state.status).not.toBe("error");
    expect(mockedReportError).not.toHaveBeenCalled();
  });

  it("leaves the room on an explicit leave, before closing", async () => {
    const apiRef = { current: null as PeerApi | null };
    render(<Harness apiRef={apiRef} />);
    await joinRoom(apiRef);
    const client = fakeSocket.FakeRoomClient.instances[0];

    await act(async () => {
      apiRef.current?.leave();
    });

    expect(client.sent).toContainEqual({ type: "leave" });
    expect(client.closeCalls).toBe(1);
    expect(client.closeForReconnectCalls).toBe(0);
  });
});

describe("teardownTransport", () => {
  it("disarms the rematch and absent-peer timers", () => {
    const client = new fakeSocket.FakeRoomClient({
      wsUrl: "ws://relay.test/room",
      role: "guest",
    });
    const rematchTimeoutRef = { current: setTimeout(() => {}, 1000) };
    const waitingForHostTimeoutRef = { current: setTimeout(() => {}, 1000) };
    const waitingForHostDeadlineAtRef = { current: 9999 };

    teardownTransport(
      {
        roomRef: { current: client as unknown as RoomClient },
        matchmakingTicketRef: { current: "ticket-1" },
        hasStartedRef: { current: true },
        rematchPendingRef: { current: true },
        quickMatchHostRef: { current: true },
        rematchTimeoutRef,
        waitingForHostTimeoutRef,
        waitingForHostDeadlineAtRef,
        stopTimer: vi.fn(),
      },
      "test teardown",
    );

    expect(rematchTimeoutRef.current).toBeNull();
    expect(waitingForHostTimeoutRef.current).toBeNull();
    expect(waitingForHostDeadlineAtRef.current).toBeNull();
    expect(client.closeForReconnectCalls).toBe(1);
    expect(client.closeCalls).toBe(0);
    expect(client.sent).not.toContainEqual({ type: "leave" });
  });
});
