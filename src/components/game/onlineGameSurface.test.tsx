// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
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
import { setLocale } from "@/i18n/language";

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
  setLocale("en");
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
      queue: "none",
      roomId: "ROOM42",
      hostSymbol: PlayerSymbol.X,
      guestSymbol: PlayerSymbol.O,
      message: "",
      rematchIncoming: false,
      rematchOutgoing: false,
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

describe("OnlineGameSurface phone layout", () => {
  it("restores the phone container and 48px recovery-action classes", () => {
    mocks.usePeerRoom.mockReturnValue(
      makePeer("host", { status: "error", message: "Room unavailable" }),
    );
    const { container } = render(
      <OnlineGameSurface
        config={{ ...config, onlineAction: "quick" }}
        onExit={vi.fn()}
      />,
    );

    const root = container.firstElementChild;
    expect(root?.className.split(/\s+/)).toEqual(
      expect.arrayContaining([
        "max-sm:h-full",
        "max-sm:max-w-none",
        "max-sm:justify-center",
      ]),
    );

    const banner = screen.getByRole("alert");
    expect(banner.parentElement?.className.split(/\s+/)).toContain(
      "max-sm:order-4",
    );
    for (const name of ["Try again", "Back to setup"]) {
      expect(
        screen.getByRole("button", { name }).className.split(/\s+/),
      ).toContain("max-sm:h-12");
    }
  });
});

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
      makePeer("host", { status: "creating", queue: "searching", roomId: "QM-7731" }),
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
    // The real search holds `creating`; only a PAIRED host sits in
    // `waiting`. The queue copy used to hang off `waiting`, so it never
    // appeared during an actual search.
    mocks.usePeerRoom.mockReturnValue(
      makePeer("host", { status: "creating", queue: "searching", roomId: "QM-9001" }),
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

describe("OnlineGameSurface play while you wait", () => {
  const searchingPeer = (overrides: Partial<PeerRoomState> = {}) =>
    makePeer("host", {
      status: "creating",
      queue: "searching",
      roomId: "QM-5150",
      gameState: freshGameState(),
      ...overrides,
    });
  const quickConfig = { ...config, onlineAction: "quick" as const };

  const startWarmup = (peer = searchingPeer(), onExit = vi.fn()) => {
    mocks.usePeerRoom.mockReturnValue(peer);
    const view = render(<OnlineGameSurface config={quickConfig} onExit={onExit} />);
    // The mount effect starts the search once; count only what happens next.
    peer.startQuickMatch.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "Play the computer while you wait" }));
    return { ...view, peer, onExit };
  };
  // Moves the SAME hook instance to a new state. The real hook's actions are
  // referentially stable; swapping in fresh mocks would re-fire the surface's
  // connection effect, which no real transition does.
  const moveTo = (
    view: ReturnType<typeof startWarmup>,
    state: Partial<PeerRoomState>,
  ) => {
    mocks.usePeerRoom.mockReturnValue({ ...view.peer, state: { ...view.peer.state, ...state } });
    view.rerender(<OnlineGameSurface config={quickConfig} onExit={view.onExit} />);
  };

  it("offers the computer to a quick-match searcher, with the queue kept", () => {
    mocks.usePeerRoom.mockReturnValue(searchingPeer());
    render(<OnlineGameSurface config={quickConfig} onExit={vi.fn()} />);

    screen.getByRole("button", { name: "Play the computer while you wait" });
    screen.getByText("Your place in line is kept while you play.");
    const levels = within(screen.getByRole("radiogroup", { name: "Computer difficulty" }));
    expect(levels.getAllByRole("radio").map((r) => r.getAttribute("aria-label"))).toEqual([
      "Easy",
      "Normal",
      "Hard",
    ]);
    expect(levels.getByRole("radio", { name: "Normal" }).getAttribute("aria-checked")).toBe("true");
  });

  it("speaks the player's language, difficulty names included", () => {
    setLocale("es");
    mocks.usePeerRoom.mockReturnValue(searchingPeer());
    render(<OnlineGameSurface config={quickConfig} onExit={vi.fn()} />);

    screen.getByRole("button", { name: "Juega contra el ordenador mientras esperas" });
    const levels = within(screen.getByRole("radiogroup", { name: "Dificultad del ordenador" }));
    expect(levels.getAllByRole("radio").map((r) => r.getAttribute("aria-label"))).toEqual([
      "Fácil",
      "Normal",
      "Difícil",
    ]);
  });

  it("never offers it to someone joining a room", () => {
    mocks.usePeerRoom.mockReturnValue(makePeer("guest", { status: "connecting", roomId: "ABC" }));
    render(<OnlineGameSurface config={{ ...config, onlineAction: "join" }} onExit={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "Play the computer while you wait" })).toBeNull();
  });

  it("starts a game against the computer without leaving the queue", () => {
    const { peer } = startWarmup();

    // A playable board, the HUD says who the opponent is, and the search is
    // still live as a one-line strip rather than a card that owns the screen.
    screen.getByRole("button", { name: /Row 1 column 1/ });
    screen.getByText("vs Computer");
    screen.getByText("Searching for an opponent");
    screen.getByRole("button", { name: "Leave queue" });
    expect(screen.queryByRole("button", { name: "Play the computer while you wait" })).toBeNull();
    expect(peer.leave).not.toHaveBeenCalled();
    expect(peer.startQuickMatch).not.toHaveBeenCalled();
  });

  it("keeps the room code out of the warm-up too", () => {
    startWarmup();
    expect(screen.queryByText("QM-5150")).toBeNull();
    expect(screen.queryByLabelText(/Room code/)).toBeNull();
  });

  it("leaves the queue and the screen from the strip", () => {
    const { peer, onExit } = startWarmup();
    fireEvent.click(screen.getByRole("button", { name: "Leave queue" }));
    expect(peer.leave).toHaveBeenCalledTimes(1);
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it("ending the computer game returns to the search card, still queued", () => {
    const { peer, onExit } = startWarmup();
    fireEvent.click(screen.getByRole("button", { name: "Exit game" }));

    screen.getByRole("button", { name: "Play the computer while you wait" });
    expect(screen.queryByRole("button", { name: "Leave queue" })).toBeNull();
    expect(peer.leave).not.toHaveBeenCalled();
    expect(onExit).not.toHaveBeenCalled();
  });

  it("tells a mid-game player the opponent was found and freezes their board", () => {
    const view = startWarmup();
    moveTo(view, { status: "creating", queue: "matched" });

    screen.getByText("Opponent found");
    screen.getByText("Starting your match…");
    // The overlay is the guard against a stray tap landing on the next board.
    const cell = screen.getByRole("button", { name: /Row 1 column 1/ });
    expect((cell as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByText("Searching for an opponent")).toBeNull();
  });

  it("hands over to the online board once the match connects", () => {
    const view = startWarmup();
    moveTo(view, { status: "creating", queue: "matched" });
    moveTo(view, {
      status: "connected",
      queue: "matched",
      gameState: {
        ...freshGameState(),
        gameMode: GameModes.ONLINE,
        gameStatus: GameStatus.ACTIVE,
      },
    });

    expect(screen.queryByText("Opponent found")).toBeNull();
    expect(screen.queryByText("Leave queue")).toBeNull();
    expect(screen.queryByText("vs Computer")).toBeNull();
    screen.getByText("Online");
  });

  it("keeps the computer game when the search ends, and offers another search", () => {
    const view = startWarmup();
    moveTo(view, {
      status: "error",
      queue: "none",
      message: "Your search expired before an opponent was found. Start a new search to try again.",
    });

    screen.getByRole("button", { name: /Row 1 column 1/ });
    screen.getByText(/search expired/);
    // The queue is over, so the way out is "Back to setup", not "Leave queue".
    screen.getByRole("button", { name: "Back to setup" });
    expect(screen.queryByRole("button", { name: "Leave queue" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Search again" }));
    expect(view.peer.startQuickMatch).toHaveBeenCalledTimes(1);

    // The new search is a new queue stage on the same hook; the game never left.
    moveTo(view, { status: "creating", queue: "searching" });
    screen.getByRole("button", { name: "Leave queue" });
    screen.getByRole("button", { name: /Row 1 column 1/ });
  });

  it("says an opponent was found even when no game is being played", () => {
    mocks.usePeerRoom.mockReturnValue(searchingPeer({ status: "creating", queue: "matched" }));
    render(<OnlineGameSurface config={quickConfig} onExit={vi.fn()} />);

    screen.getByText("Opponent found");
    expect(screen.queryByRole("button", { name: "Play the computer while you wait" })).toBeNull();
    expect(screen.queryByText("QM-5150")).toBeNull();
  });

  it("shows how many others are looking, in the strip, while playing", () => {
    mocks.playerCount = { players: 5, waiting: 3 };
    startWarmup();
    screen.getByText("2 other players looking");
  });
});

describe("OnlineGameSurface play while you wait (created room)", () => {
  const openRoom = (overrides: Partial<PeerRoomState> = {}) =>
    makePeer("host", {
      status: "waiting",
      roomId: "FRIDAY-9",
      gameState: freshGameState(),
      ...overrides,
    });
  const createConfig = { ...config, onlineAction: "create" as const };
  const play = "Play the computer while you wait";

  const startWarmup = (peer = openRoom(), onExit = vi.fn()) => {
    mocks.usePeerRoom.mockReturnValue(peer);
    const view = render(<OnlineGameSurface config={createConfig} onExit={onExit} />);
    fireEvent.click(screen.getByRole("button", { name: play }));
    return { ...view, peer, onExit };
  };
  const moveTo = (view: ReturnType<typeof startWarmup>, state: Partial<PeerRoomState>) => {
    mocks.usePeerRoom.mockReturnValue({ ...view.peer, state: { ...view.peer.state, ...state } });
    view.rerender(<OnlineGameSurface config={createConfig} onExit={view.onExit} />);
  };
  const stubClipboard = () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    return writeText;
  };

  it("offers the computer to a host whose room is open, code still in reach", () => {
    mocks.usePeerRoom.mockReturnValue(openRoom());
    render(<OnlineGameSurface config={createConfig} onExit={vi.fn()} />);

    screen.getByText("FRIDAY-9");
    screen.getByRole("button", { name: /Copy code/ });
    screen.getByRole("button", { name: play });
    screen.getByText("Your room stays open while you play.");
    const levels = within(screen.getByRole("radiogroup", { name: "Computer difficulty" }));
    expect(levels.getAllByRole("radio")).toHaveLength(3);
  });

  it("does not offer it while the room is still being built", () => {
    mocks.usePeerRoom.mockReturnValue(openRoom({ status: "creating" }));
    render(<OnlineGameSurface config={createConfig} onExit={vi.fn()} />);
    expect(screen.queryByRole("button", { name: play })).toBeNull();
  });

  it("speaks the player's language", () => {
    setLocale("es");
    mocks.usePeerRoom.mockReturnValue(openRoom());
    render(<OnlineGameSurface config={createConfig} onExit={vi.fn()} />);
    screen.getByRole("button", { name: "Juega contra el ordenador mientras esperas" });
    screen.getByText("Tu sala sigue abierta mientras juegas.");
  });

  it("starts a game without closing the room", () => {
    const { peer } = startWarmup();

    screen.getByRole("button", { name: /Row 1 column 1/ });
    screen.getByText("vs Computer");
    screen.getByText("Waiting for an opponent");
    expect(screen.queryByRole("button", { name: play })).toBeNull();
    expect(peer.leave).not.toHaveBeenCalled();
    // The room is a quiet strip now, not a card that owns the screen.
    expect(screen.queryByText("Room ready")).toBeNull();
  });

  it("keeps the invitation one tap away while playing", async () => {
    const writeText = stubClipboard();
    startWarmup();

    fireEvent.click(screen.getByRole("button", { name: "Copy link" }));
    await vi.waitFor(() =>
      expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/?room=FRIDAY-9`),
    );
    await screen.findByText("Copied");
  });

  it("prefers the phone's share sheet when there is one", () => {
    const share = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "share", { value: share, configurable: true });
    try {
      startWarmup();
      expect(screen.queryByRole("button", { name: "Copy link" })).toBeNull();
      fireEvent.click(screen.getByRole("button", { name: "Share" }));
      expect(share).toHaveBeenCalledWith(
        expect.objectContaining({ url: `${window.location.origin}/?room=FRIDAY-9` }),
      );
    } finally {
      Reflect.deleteProperty(navigator, "share");
    }
  });

  it("says so when the link cannot be copied", async () => {
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: vi.fn().mockRejectedValue(new Error("denied")) },
      configurable: true,
    });
    startWarmup();
    fireEvent.click(screen.getByRole("button", { name: "Copy link" }));
    await screen.findByText("Couldn't copy the link.");
  });

  it("closes the room and the screen from the strip", () => {
    const { peer, onExit } = startWarmup();
    fireEvent.click(screen.getByRole("button", { name: "Close room" }));
    expect(peer.leave).toHaveBeenCalledTimes(1);
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it("ending the computer game brings the room card back, still open", () => {
    const { peer, onExit } = startWarmup();
    fireEvent.click(screen.getByRole("button", { name: "Exit game" }));

    screen.getByText("FRIDAY-9");
    screen.getByRole("button", { name: play });
    expect(peer.leave).not.toHaveBeenCalled();
    expect(onExit).not.toHaveBeenCalled();
  });

  it("freezes the board the moment an opponent is seated", () => {
    const view = startWarmup();
    moveTo(view, { status: "connecting", message: "Opponent connecting…" });

    screen.getByText("Opponent joined");
    screen.getByText("Starting your match…");
    const cell = screen.getByRole("button", { name: /Row 1 column 1/ });
    expect((cell as HTMLButtonElement).disabled).toBe(true);
    expect(cell.getAttribute("aria-label")).toMatch(/paused/i);
    expect(screen.queryByText("Waiting for an opponent")).toBeNull();
    // The room's own "connecting" banner would be a second voice for the same fact.
    expect(screen.queryByText("Opponent connecting…")).toBeNull();
  });

  it("hands over to the online board once the game starts", () => {
    const view = startWarmup();
    moveTo(view, { status: "connecting" });
    moveTo(view, {
      status: "connected",
      gameState: { ...freshGameState(), gameMode: GameModes.ONLINE, gameStatus: GameStatus.ACTIVE },
    });

    expect(screen.queryByText("Opponent joined")).toBeNull();
    expect(screen.queryByText("vs Computer")).toBeNull();
    expect(screen.queryByRole("button", { name: "Close room" })).toBeNull();
    screen.getByText("Online");
  });

  it("returns to the open room when the opponent drops before the game starts", () => {
    const view = startWarmup();
    moveTo(view, { status: "connecting" });
    moveTo(view, { status: "waiting" });

    expect(screen.queryByText("Opponent joined")).toBeNull();
    screen.getByText("Waiting for an opponent");
    // Not frozen any more. (Whether the cell is tappable also depends on whose
    // turn the random draw gave the game, so read the reason, not `disabled`.)
    const cell = screen.getByRole("button", { name: /Row 1 column 1/ });
    expect(cell.getAttribute("aria-label")).not.toMatch(/paused/i);
  });

  it("keeps the computer game through a connection blip", () => {
    const view = startWarmup();
    moveTo(view, { status: "reconnecting", message: "Reconnecting…" });

    screen.getByText("vs Computer");
    screen.getByText("Waiting for an opponent");
    // No empty online board sneaks in beside the game being played.
    expect(screen.queryByText("Online")).toBeNull();
  });

  it("keeps the computer game when the room closes, and says why once", () => {
    const view = startWarmup();
    moveTo(view, { status: "disconnected", message: "Your opponent left the room." });

    screen.getByRole("button", { name: /Row 1 column 1/ });
    expect(screen.getAllByText("Your opponent left the room.")).toHaveLength(1);
    screen.getByRole("button", { name: "Back to setup" });
    // There is no queue to rejoin: a closed room is a new room, made from setup.
    expect(screen.queryByRole("button", { name: "Search again" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Close room" })).toBeNull();
  });

  it("keeps the computer game when the room fails to open, with a way out", () => {
    const onExit = vi.fn();
    const view = startWarmup(openRoom(), onExit);
    moveTo(view, { status: "error", message: "Room connect failed: offline" });

    screen.getByRole("button", { name: /Row 1 column 1/ });
    expect(screen.getAllByText("Room connect failed: offline")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Back to setup" }));
    expect(onExit).toHaveBeenCalled();
  });
});
