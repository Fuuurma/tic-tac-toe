import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { builtinEnvironments } from "vitest/runtime";
import { cleanup, fireEvent, render } from "@testing-library/react";
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

beforeAll(async () => {
  const env = await builtinEnvironments.jsdom.setup(globalThis, {});
  teardownEnvironment = () => env.teardown(globalThis);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
});

afterAll(async () => {
  await teardownEnvironment?.();
});

afterEach(() => {
  cleanup();
  mocks.playerCount = null;
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
      pausedStash: null,
      rematchIncoming: false,
      rematchOutgoing: false,
      leftBySelf: false,
      canRetryReconnect: false,
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

const terminalCases: { name: string; message: string }[] = [
  { name: "the opponent left the room", message: t("peer.opponentLeft") },
  { name: "the room expired", message: t("peer.opponentGone") },
  {
    name: "the absent-peer timeout severed the room",
    message: t("mm.opponentNever"),
  },
];

describe("OnlineGameSurface disconnected banner", () => {
  for (const terminal of terminalCases) {
    it(`hides Retry now when ${terminal.name}`, () => {
      mocks.usePeerRoom.mockReturnValue(
        makePeer({
          status: "disconnected",
          message: terminal.message,
          canRetryReconnect: false,
        }),
      );

      const view = render(<OnlineGameSurface config={config} onExit={vi.fn()} />);

      expect(view.queryByRole("button", { name: "Retry now" })).toBeNull();
      expect(view.getByRole("button", { name: "Back to setup" })).toBeTruthy();
    });
  }

  it("keeps Retry now on a transport disconnect the socket can still recover", () => {
    const peer = makePeer({
      status: "disconnected",
      message: t("mm.disconnected"),
      canRetryReconnect: true,
    });
    mocks.usePeerRoom.mockReturnValue(peer);

    const view = render(<OnlineGameSurface config={config} onExit={vi.fn()} />);

    expect(view.getByRole("button", { name: "Retry now" })).toBeTruthy();
    expect(view.getByRole("button", { name: "Back to setup" })).toBeTruthy();

    fireEvent.click(view.getByRole("button", { name: "Retry now" }));

    expect(peer.retryReconnect).toHaveBeenCalledTimes(1);
  });
});
