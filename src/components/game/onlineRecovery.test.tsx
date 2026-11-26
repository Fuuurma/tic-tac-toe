import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { builtinEnvironments } from "vitest/runtime";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { OnlineGameSurface } from "./onlineGameSurface";
import { freshGameState, type GameState } from "@/game/logic";
import { Color, GameModes, GameStatus, PlayerSymbol, SymbolShape } from "@/game/constants";
import type { PeerRoomState } from "@/hooks/usePeerRoom";
import { t } from "@/i18n/language";

const mocks = vi.hoisted(() => ({
  usePeerRoom: vi.fn(),
  recordWin: vi.fn(),
  recordLoss: vi.fn(),
  playerCount: null as { players: number; waiting: number } | null,
}));

vi.mock("@/hooks/usePeerRoom", () => ({
  usePeerRoom: mocks.usePeerRoom,
}));
vi.mock("@/hooks/useGameStats", () => ({
  useGameStats: () => ({
    recordWin: mocks.recordWin,
    recordLoss: mocks.recordLoss,
  }),
}));
vi.mock("thinking-orbs", () => ({ ThinkingOrb: () => null }));
vi.mock("@/hooks/usePlayerCount", () => ({
  usePlayerCount: () => ({ count: mocks.playerCount, refresh: () => {} }),
}));

let teardownEnvironment: (() => unknown) | undefined;
let onLine = true;

beforeAll(async () => {
  const env = await builtinEnvironments.jsdom.setup(globalThis, {});
  teardownEnvironment = () => env.teardown(globalThis);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  Object.defineProperty(window.navigator, "onLine", {
    configurable: true,
    get: () => onLine,
  });
});

afterAll(async () => {
  await teardownEnvironment?.();
});

afterEach(() => {
  cleanup();
  mocks.playerCount = null;
  onLine = true;
});

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal("ResizeObserver", ResizeObserverStub);

function startedGame(): GameState {
  return {
    ...freshGameState(),
    gameMode: GameModes.ONLINE,
    gameStatus: GameStatus.ACTIVE,
  };
}

function makePeer(stateOverrides: Partial<PeerRoomState> = {}) {
  return {
    state: {
      role: "guest",
      status: "connected",
      queue: "none",
      roomId: "ROOM42",
      hostSymbol: PlayerSymbol.X,
      guestSymbol: PlayerSymbol.O,
      message: "",
      rematchIncoming: false,
      rematchOutgoing: false,
      leftBySelf: false,
      canRetryReconnect: true,
      gameState: startedGame(),
      ...stateOverrides,
    } as PeerRoomState,
    startAsHost: vi.fn(),
    startQuickMatch: vi.fn(),
    joinAsGuest: vi.fn(),
    sendMove: vi.fn(),
    requestRematch: vi.fn(),
    declineRematch: vi.fn(),
    cancelRematch: vi.fn(),
    retryReconnect: vi.fn(),
    leave: vi.fn(),
    closeTransport: vi.fn(),
    updatePendingSettings: vi.fn(),
    setPaused: vi.fn(),
    paused: false,
  };
}

const config = {
  displayName: "Player",
  color: Color.BLUE,
  playerShape: SymbolShape.X,
  gameMode: GameModes.ONLINE,
  onlineRoomId: "ROOM42",
  onlineAction: "join" as const,
};

const OFFLINE_COPY = "You're offline. Online play is paused until you reconnect.";

const terminalCases = [
  { name: "the opponent left", message: t("peer.opponentLeft") },
  { name: "the room expired", message: t("peer.opponentGone") },
  { name: "the host never connected", message: t("mm.hostNever") },
];

describe("OnlineGameSurface recovery when the device goes offline", () => {
  it("shows the offline copy and disables Retry while the device is offline", () => {
    onLine = false;
    const peer = makePeer({ status: "reconnecting", message: "Socket dropped" });
    mocks.usePeerRoom.mockReturnValue(peer);

    const view = render(<OnlineGameSurface config={config} onExit={vi.fn()} />);

    const banner = view.getByText(OFFLINE_COPY).closest("div[role='status']");
    expect(banner).toBeTruthy();
    expect(banner?.textContent).not.toContain("Socket dropped");

    const retry = view.getByRole("button", { name: "Retry now" }) as HTMLButtonElement;
    expect(retry.disabled).toBe(true);
    expect(retry.getAttribute("aria-disabled")).toBe("true");
  });

  it("keeps the room-open detail while offline", () => {
    onLine = false;
    mocks.usePeerRoom.mockReturnValue(makePeer({ status: "reconnecting" }));

    const view = render(<OnlineGameSurface config={config} onExit={vi.fn()} />);

    expect(
      view.getByText("Room stays open ~30s while the connection restores."),
    ).toBeTruthy();
  });

  it("never retries while the device stays online", () => {
    const peer = makePeer({ status: "reconnecting" });
    mocks.usePeerRoom.mockReturnValue(peer);

    render(<OnlineGameSurface config={config} onExit={vi.fn()} />);

    expect(peer.retryReconnect).not.toHaveBeenCalled();
  });

  it("retries once when the network comes back", async () => {
    onLine = false;
    const peer = makePeer({ status: "reconnecting" });
    mocks.usePeerRoom.mockReturnValue(peer);

    render(<OnlineGameSurface config={config} onExit={vi.fn()} />);
    expect(peer.retryReconnect).not.toHaveBeenCalled();

    await act(async () => {
      onLine = true;
      window.dispatchEvent(new Event("online"));
    });

    expect(peer.retryReconnect).toHaveBeenCalledTimes(1);
  });

  it("retries once when the network comes back on a disconnected game", async () => {
    onLine = false;
    const peer = makePeer({ status: "disconnected" });
    mocks.usePeerRoom.mockReturnValue(peer);

    render(<OnlineGameSurface config={config} onExit={vi.fn()} />);
    expect(peer.retryReconnect).not.toHaveBeenCalled();

    await act(async () => {
      onLine = true;
      window.dispatchEvent(new Event("online"));
    });

    expect(peer.retryReconnect).toHaveBeenCalledTimes(1);
  });

  it("does not retry when the network comes back on a connected game", async () => {
    onLine = false;
    const peer = makePeer({ status: "connected" });
    mocks.usePeerRoom.mockReturnValue(peer);

    render(<OnlineGameSurface config={config} onExit={vi.fn()} />);

    await act(async () => {
      onLine = true;
      window.dispatchEvent(new Event("online"));
    });

    expect(peer.retryReconnect).not.toHaveBeenCalled();
  });

  for (const terminal of terminalCases) {
    it(`keeps a terminal room end terminal when the network returns after ${terminal.name}`, async () => {
      onLine = false;
      const peer = makePeer({
        status: "disconnected",
        canRetryReconnect: false,
        message: terminal.message,
      });
      mocks.usePeerRoom.mockReturnValue(peer);

      render(<OnlineGameSurface config={config} onExit={vi.fn()} />);

      await act(async () => {
        onLine = true;
        window.dispatchEvent(new Event("online"));
      });

      expect(peer.retryReconnect).not.toHaveBeenCalled();
    });
  }

  it("still retries a reconnecting game when canRetryReconnect is false", async () => {
    onLine = false;
    const peer = makePeer({ status: "reconnecting", canRetryReconnect: false });
    mocks.usePeerRoom.mockReturnValue(peer);

    render(<OnlineGameSurface config={config} onExit={vi.fn()} />);

    await act(async () => {
      onLine = true;
      window.dispatchEvent(new Event("online"));
    });

    expect(peer.retryReconnect).toHaveBeenCalledTimes(1);
  });
});

describe("OnlineGameSurface retry after the connection gives up", () => {
  it("shows Retry beside Back to setup on a disconnected game", () => {
    mocks.usePeerRoom.mockReturnValue(makePeer({ status: "disconnected" }));

    const view = render(<OnlineGameSurface config={config} onExit={vi.fn()} />);

    expect(view.getByRole("button", { name: "Retry now" })).toBeTruthy();
    expect(view.getByRole("button", { name: "Back to setup" })).toBeTruthy();
  });

  it("falls back to the disconnected copy when the reason is empty", () => {
    mocks.usePeerRoom.mockReturnValue(makePeer({ status: "disconnected", message: "" }));

    const view = render(<OnlineGameSurface config={config} onExit={vi.fn()} />);

    expect(view.getByText("Disconnected")).toBeTruthy();
  });

  it("calls retryReconnect when Retry is pressed", () => {
    const peer = makePeer({ status: "disconnected" });
    mocks.usePeerRoom.mockReturnValue(peer);

    const view = render(<OnlineGameSurface config={config} onExit={vi.fn()} />);

    fireEvent.click(view.getByRole("button", { name: "Retry now" }));

    expect(peer.retryReconnect).toHaveBeenCalledTimes(1);
  });

  it("disables Retry while the device is offline", () => {
    onLine = false;
    mocks.usePeerRoom.mockReturnValue(makePeer({ status: "disconnected" }));

    const view = render(<OnlineGameSurface config={config} onExit={vi.fn()} />);

    const retry = view.getByRole("button", { name: "Retry now" }) as HTMLButtonElement;
    expect(retry.disabled).toBe(true);
    expect(retry.getAttribute("aria-disabled")).toBe("true");
  });
});
