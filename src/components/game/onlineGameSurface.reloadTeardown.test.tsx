"@vitest-environment jsdom";


import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OnlineGameSurface } from "./onlineGameSurface";
import { Color, GameModes, SymbolShape } from "@/game/constants";
import { readOnlineSession } from "@/lib/onlineSession";
import type { GameStats } from "@/hooks/useGameStats";

const mocks = vi.hoisted(() => ({
  stats: {
    totalGames: 0,
    wins: 0,
    losses: 0,
    currentWinStreak: 0,
    bestWinStreak: 0,
    breakdown: {},
  } as GameStats,
}));

vi.mock("@/hooks/useGameStats", () => ({
  useGameStats: () => ({
    stats: mocks.stats,
    recordWin: vi.fn(),
    recordLoss: vi.fn(),
  }),
}));
vi.mock("@/hooks/usePlayerCount", () => ({
  usePlayerCount: () => ({ count: null, refresh: () => {} }),
}));
vi.mock("thinking-orbs", () => ({ ThinkingOrb: () => null }));

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

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal("ResizeObserver", ResizeObserverStub);

const resumeConfig = {
  displayName: "Ada",
  color: Color.BLUE,
  playerShape: SymbolShape.X,
  gameMode: GameModes.ONLINE,
  onlineRoomId: "ROOM42",
  onlineAction: "join" as const,
  resumeRole: "guest" as const,
};

beforeEach(() => {
  fakeSocket.FakeRoomClient.instances.length = 0;
  window.sessionStorage.clear();
});

afterEach(() => {
  cleanup();
  window.sessionStorage.clear();
});

describe("OnlineGameSurface passive teardown on resume", () => {
  it("reseats a guest through joinAsGuest and writes the session once role and room id exist", () => {
    render(<OnlineGameSurface config={resumeConfig} onExit={vi.fn()} />);

    const client = fakeSocket.FakeRoomClient.instances[0];
    expect(client).toBeDefined();
    expect(client.connectCalls).toBe(1);
    expect(readOnlineSession()).toMatchObject({
      roomId: "ROOM42",
      role: "guest",
      onlineAction: "join",
    });
    screen.getByText("Joining room…");
  });

  it("recycles the first transport for reconnect on replacement and keeps the new attempt connecting", async () => {
    const view = render(
      <OnlineGameSurface config={resumeConfig} onExit={vi.fn()} />,
    );
    const first = fakeSocket.FakeRoomClient.instances[0];

    view.rerender(
      <OnlineGameSurface
        config={{ ...resumeConfig, onlineRoomId: "ROOM99" }}
        onExit={vi.fn()}
      />,
    );
    const second = fakeSocket.FakeRoomClient.instances[1];

    expect(first.closeForReconnectCalls).toBe(1);
    expect(first.closeCalls).toBe(0);
    expect(first.sent).not.toContainEqual({ type: "leave" });

    expect(second).toBeDefined();
    expect(second.connectCalls).toBe(1);
    screen.getByText("Joining room…");

    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByText("Disconnected")).toBeNull();
    screen.getByText("Joining room…");

    expect(readOnlineSession()).toMatchObject({ roomId: "ROOM99" });
  });

  it("unmount closes the transport for reconnect without clearing the session", () => {
    const view = render(
      <OnlineGameSurface config={resumeConfig} onExit={vi.fn()} />,
    );
    const client = fakeSocket.FakeRoomClient.instances[0];

    view.unmount();

    expect(client.closeForReconnectCalls).toBe(1);
    expect(client.closeCalls).toBe(0);
    expect(client.sent).not.toContainEqual({ type: "leave" });
    expect(readOnlineSession()).toMatchObject({ roomId: "ROOM42" });
  });
});
