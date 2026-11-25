"@vitest-environment jsdom";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { OnlineGameSurface } from "./onlineGameSurface";
import { freshGameState, type GameState } from "@/game/logic";
import {
  Color,
  GameModes,
  GameStatus,
  PlayerSymbol,
  SymbolShape,
} from "@/game/constants";
import type { PeerRoomState } from "@/hooks/usePeerRoom";
import type { GameStats } from "@/hooks/useGameStats";
import { setLocale } from "@/i18n/language";

const mocks = vi.hoisted(() => ({
  usePeerRoom: vi.fn(),
  useGameStats: vi.fn(),
  recordWin: vi.fn(),
  recordLoss: vi.fn(),
  playerCount: null as { players: number; waiting: number } | null,
}));

vi.mock("@/hooks/usePeerRoom", () => ({
  usePeerRoom: mocks.usePeerRoom,
}));
vi.mock("@/hooks/useGameStats", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/hooks/useGameStats")>();
  return { ...actual, useGameStats: mocks.useGameStats };
});
vi.mock("thinking-orbs", () => ({ ThinkingOrb: () => null }));
vi.mock("@/hooks/usePlayerCount", () => ({
  usePlayerCount: () => ({ count: mocks.playerCount, refresh: () => {} }),
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal("ResizeObserver", ResizeObserverStub);

const FIXTURE_STATS: GameStats = {
  totalGames: 4,
  wins: 3,
  losses: 1,
  currentWinStreak: 1,
  bestWinStreak: 5,
  breakdown: { [GameModes.ONLINE]: { wins: 3, losses: 1 } },
};

beforeEach(() => {
  mocks.useGameStats.mockReturnValue({
    stats: FIXTURE_STATS,
    recordWin: mocks.recordWin,
    recordLoss: mocks.recordLoss,
  });
});

afterEach(() => {
  mocks.playerCount = null;
  setLocale("en");
  cleanup();
});

function liveOnlineGame(): GameState {
  return {
    ...freshGameState(),
    gameMode: GameModes.ONLINE,
    gameStatus: GameStatus.ACTIVE,
    moveCount: 3,
  };
}

function makePeer(
  role: "host" | "guest",
  stateOverrides: Partial<PeerRoomState> = {},
) {
  return {
    state: {
      role,
      status: "connected",
      queue: "none",
      roomId: "ROOM42",
      hostSymbol: PlayerSymbol.X,
      guestSymbol: PlayerSymbol.O,
      message: "",
      rematchIncoming: false,
      rematchOutgoing: false,
      leftBySelf: false,
      gameState: liveOnlineGame(),
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

describe("OnlineGameSurface saved record", () => {
  it("shows the saved record in the HUD of a connected online game", () => {
    mocks.usePeerRoom.mockReturnValue(makePeer("guest"));
    render(<OnlineGameSurface config={config} onExit={vi.fn()} />);

    screen.getByText("3 wins");
    screen.getByText(/1 losses?/);
    screen.getByText("Best 5");
    screen.getByRole("status", { name: "Record: 3 wins, 1 losses" });
  });

  it("shares one stats instance from the warm-up through the handoff", () => {
    const peer = makePeer("host", {
      status: "creating",
      queue: "searching",
      roomId: "QM-5150",
      gameState: freshGameState(),
    });
    mocks.usePeerRoom.mockReturnValue(peer);
    const quickConfig = { ...config, onlineAction: "quick" as const };
    const view = render(
      <OnlineGameSurface config={quickConfig} onExit={vi.fn()} />,
    );

    mocks.useGameStats.mockClear();
    fireEvent.click(
      screen.getByRole("button", {
        name: "Play the computer while you wait",
      }),
    );

    expect(mocks.useGameStats).toHaveBeenCalledTimes(1);
    screen.getByText("3 wins");
    screen.getByText(/1 losses?/);
    screen.getByText("Best 5");

    mocks.usePeerRoom.mockReturnValue({
      ...peer,
      state: { ...peer.state, queue: "matched" as const },
    });
    view.rerender(<OnlineGameSurface config={quickConfig} onExit={vi.fn()} />);
    mocks.usePeerRoom.mockReturnValue({
      ...peer,
      state: {
        ...peer.state,
        status: "connected",
        queue: "matched" as const,
        gameState: liveOnlineGame(),
      },
    });
    view.rerender(<OnlineGameSurface config={quickConfig} onExit={vi.fn()} />);

    screen.getByText("Online");
    screen.getByText("3 wins");
    screen.getByText(/1 losses?/);
    screen.getByText("Best 5");
  });
});
