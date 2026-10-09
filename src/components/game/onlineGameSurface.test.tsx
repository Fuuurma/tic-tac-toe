// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
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

// The surface's transport lives in usePeerRoom — that hook is the seam
// boundary, so tests mock it and drive the exact renderable state a real
// connected session produces (a guest at a terminal board, etc.).
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
// The orbs animate on canvas, which jsdom does not implement.
vi.mock("thinking-orbs", () => ({ ThinkingOrb: () => null }));

// The searching state polls the live queue; keep it inert so these render
// tests do not depend on the network.
vi.mock("@/hooks/usePlayerCount", () => ({
  usePlayerCount: () => ({ count: mocks.playerCount, refresh: () => {} }),
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

// PlayersPanel measures itself in useLayoutEffect; jsdom has no
// ResizeObserver.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal("ResizeObserver", ResizeObserverStub);

afterEach(() => {
  mocks.playerCount = null;
  cleanup();
});

function terminalOnlineGame(): GameState {
  return {
    ...freshGameState(),
    gameMode: GameModes.ONLINE,
    gameStatus: GameStatus.COMPLETED,
    winner: PlayerSymbol.X,
    moveCount: 5,
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
      roomId: "ROOM42",
      hostSymbol: PlayerSymbol.X,
      guestSymbol: PlayerSymbol.O,
      message: "",
      rematchIncoming: false,
      rematchOutgoing: false,
      queuePosition: null,
      gameState: terminalOnlineGame(),
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

describe("OnlineGameSurface terminal rematch affordances", () => {
  it("offers Play again to a guest too — either side may ask", () => {
    // This used to be host-only: a guest's accept was dropped unless the
    // host had asked first, so a guest could never start a rematch.
    mocks.usePeerRoom.mockReturnValue(makePeer("guest"));
    render(<OnlineGameSurface config={config} onExit={vi.fn()} />);

    screen.getByRole("button", { name: "Play again" });
    expect(
      screen.queryByRole("button", { name: "Start a new game" }),
    ).toBeNull();
  });

  it("renders the icon Play again button for the host", () => {
    mocks.usePeerRoom.mockReturnValue(makePeer("host"));
    render(<OnlineGameSurface config={config} onExit={vi.fn()} />);

    screen.getByRole("button", { name: "Play again" });
  });

  it("shows the labeled prompt to either side when a request is pending", () => {
    for (const role of ["host", "guest"] as const) {
      const view = render(
        <OnlineGameSurface config={config} onExit={vi.fn()} />,
      );
      mocks.usePeerRoom.mockReturnValue(
        makePeer(role, { rematchIncoming: true }),
      );
      view.rerender(<OnlineGameSurface config={config} onExit={vi.fn()} />);

      screen.getByRole("button", { name: "Accept rematch" });
      // Answering a prompt and asking for one at the same time would
      // leave both sides waiting, so the ask button steps aside.
      expect(screen.queryByRole("button", { name: "Play again" })).toBeNull();
      view.unmount();
    }
  });

  it("lets a guest decline, and lets the asker cancel", () => {
    const incoming = render(
      <OnlineGameSurface config={config} onExit={vi.fn()} />,
    );
    mocks.usePeerRoom.mockReturnValue(
      makePeer("guest", { rematchIncoming: true }),
    );
    incoming.rerender(<OnlineGameSurface config={config} onExit={vi.fn()} />);
    screen.getByRole("button", { name: "Decline rematch" });
    incoming.unmount();

    mocks.usePeerRoom.mockReturnValue(
      makePeer("guest", { rematchOutgoing: true }),
    );
    render(<OnlineGameSurface config={config} onExit={vi.fn()} />);
    screen.getByRole("button", { name: "Cancel rematch" });
  });
});

describe("OnlineGameSurface result recording (F474)", () => {
  // F474: the result dedupe keyed on moveCount, which is host-controlled —
  // a host resending the same terminal frame with a different accepted
  // moveCount inflated the guest's local tally. The latch must hold one
  // result per terminal episode and re-arm only on a genuinely live frame.
  const liveGame = (): GameState => ({
    ...freshGameState(),
    gameMode: GameModes.ONLINE,
    gameStatus: GameStatus.ACTIVE,
  });

  it("repeated terminal frames with different accepted moveCounts record one result", () => {
    mocks.recordLoss.mockClear();
    const peer = makePeer("guest");
    mocks.usePeerRoom.mockReturnValue(peer);
    const { rerender } = render(
      <OnlineGameSurface config={config} onExit={vi.fn()} />,
    );
    expect(mocks.recordLoss).toHaveBeenCalledTimes(1);

    for (const moveCount of [6, 3, 9]) {
      peer.state = {
        ...peer.state,
        gameState: { ...peer.state.gameState, moveCount },
      };
      rerender(<OnlineGameSurface config={config} onExit={vi.fn()} />);
    }
    expect(mocks.recordLoss).toHaveBeenCalledTimes(1);
  });

  it("a reconnect replay of the terminal result adds nothing, then a new round counts once", () => {
    mocks.recordLoss.mockClear();
    const peer = makePeer("guest");
    mocks.usePeerRoom.mockReturnValue(peer);
    const { rerender } = render(
      <OnlineGameSurface config={config} onExit={vi.fn()} />,
    );
    // Identical frame replayed (state_snapshot resync) — still one result.
    peer.state = { ...peer.state, gameState: { ...peer.state.gameState } };
    rerender(<OnlineGameSurface config={config} onExit={vi.fn()} />);
    expect(mocks.recordLoss).toHaveBeenCalledTimes(1);

    // Rematch lands a fresh ACTIVE round, then a new terminal — counts again.
    peer.state = { ...peer.state, gameState: liveGame() };
    rerender(<OnlineGameSurface config={config} onExit={vi.fn()} />);
    peer.state = { ...peer.state, gameState: terminalOnlineGame() };
    rerender(<OnlineGameSurface config={config} onExit={vi.fn()} />);
    expect(mocks.recordLoss).toHaveBeenCalledTimes(2);
  });
});

describe("OnlineGameSurface room-code disclosure", () => {
  // A room code is a join credential for a specific invited person. Quick
  // Match is paired by the service, so it used to hand out the internal room
  // id of a match nobody asked to share — both as a share banner while
  // searching and as a copyable chip in the HUD once play started.
  it("shows no room code while a quick match is searching", () => {
    mocks.usePeerRoom.mockReturnValue(
      makePeer("host", { status: "waiting", roomId: "QM-7731" }),
    );
    render(
      <OnlineGameSurface config={{ ...config, onlineAction: "quick" }} onExit={vi.fn()} />,
    );

    expect(screen.queryByText("QM-7731")).toBeNull();
    expect(screen.queryByText("Room ready")).toBeNull();
    expect(screen.queryByRole("button", { name: /Copy code/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Copy invite link/ })).toBeNull();
    screen.getByText("Finding an opponent…");
  });

  it("keeps the room code out of the HUD for a quick-match game", () => {
    mocks.usePeerRoom.mockReturnValue(
      makePeer("host", { status: "connected", roomId: "QM-7731" }),
    );
    render(
      <OnlineGameSurface config={{ ...config, onlineAction: "quick" }} onExit={vi.fn()} />,
    );

    expect(screen.queryByText("QM-7731")).toBeNull();
    expect(screen.queryByLabelText(/Room code/)).toBeNull();
  });

  it("still shares the code for a room the user deliberately created", () => {
    mocks.usePeerRoom.mockReturnValue(
      makePeer("host", { status: "waiting", roomId: "FRIDAY-9" }),
    );
    render(
      <OnlineGameSurface config={{ ...config, onlineAction: "create" }} onExit={vi.fn()} />,
    );

    screen.getByText("Room ready");
    screen.getByText("FRIDAY-9");
    screen.getByRole("button", { name: /Copy code/ });
    expect(screen.queryByText("Finding an opponent…")).toBeNull();
  });
});

describe("OnlineGameSurface quick-match queue copy", () => {
  const searching = (count: { players: number; waiting: number } | null) => {
    mocks.playerCount = count;
    mocks.usePeerRoom.mockReturnValue(
      makePeer("host", { status: "waiting", roomId: "QM-9001" }),
    );
    render(
      <OnlineGameSurface config={{ ...config, onlineAction: "quick" }} onExit={vi.fn()} />,
    );
  };

  // The health read counts YOU, because you are in the queue while you read
  // it. Reporting the raw total gave "0 players online" to a player who was
  // online and searching, which is both self-contradictory and reads like a
  // dead lobby.
  it("never claims nobody is online while the player is searching", () => {
    searching({ players: 1, waiting: 1 });
    expect(screen.queryByText(/0 players online/)).toBeNull();
    screen.getByText(/You're first in the queue/);
  });

  it("counts the other players who can actually be paired", () => {
    searching({ players: 5, waiting: 3 });
    screen.getByText(/2 other players are looking/);
  });

  it("handles a single other player in the queue", () => {
    searching({ players: 2, waiting: 2 });
    screen.getByText(/1 other player is looking/);
  });

  it("says nothing about the queue until the first read lands", () => {
    searching(null);
    screen.getByText("Checking the queue.");
  });
});
