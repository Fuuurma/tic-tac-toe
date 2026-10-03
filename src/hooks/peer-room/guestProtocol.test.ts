import { describe, it, expect, vi } from "vitest";
import {
  Color,
  GameModes,
  GameStatus,
  PlayerSymbol,
} from "@/game/constants";
import { createInitialGameState } from "@/game/logic";
import type { GameState } from "@/game/logic";
import type { PeerRoomState } from "../usePeerRoom";
import { isPeerMessage } from "@/lib/peer";
import { handleGuestMessage, type GuestProtocolDeps } from "./guestProtocol";

// Coverage pins for the state_snapshot branch (DST-04 reconnect pull,
// review 2026-10-03 P2): before this file the shared snapshot path —
// deadline resynthesis, rollback-snapshot clear, symbol preservation —
// had zero handleGuestMessage coverage and shipped green.

function baseGame(overrides: Partial<GameState> = {}): GameState {
  return {
    ...createInitialGameState({
      gameMode: GameModes.ONLINE,
      playerXName: "Host",
      playerOName: "Guest",
      playerColor: Color.BLUE,
      opponentColor: Color.RED,
      humanSymbol: PlayerSymbol.X,
    }),
    ...overrides,
  };
}

/** Wire payloads never carry the host's absolute deadline — only the
 *  remaining budget (toWireGameState strips it). */
function wireGame(overrides: Partial<GameState> = {}): GameState {
  return baseGame({
    turnDeadlineAt: undefined,
    turnTimeRemaining: 7_000,
    ...overrides,
  });
}

function makeDeps(game: GameState, roomInit: Partial<PeerRoomState> = {}) {
  let roomState = { gameState: game, status: "connected", ...roomInit } as PeerRoomState;
  const deps: GuestProtocolDeps = {
    stateRef: { current: game },
    guestSymbolRef: { current: PlayerSymbol.O },
    pendingGuestStateRef: { current: null },
    setState: (updater) => {
      roomState = typeof updater === "function" ? updater(roomState) : updater;
    },
    stopTimer: vi.fn(),
  };
  return { deps, getRoom: () => roomState };
}

describe("handleGuestMessage state_snapshot", () => {
  it("replaces state and resynthesizes turnDeadlineAt from turnTimeRemaining", () => {
    const { deps, getRoom } = makeDeps(baseGame());
    const wire = wireGame({ moveCount: 3 });
    const before = Date.now();

    handleGuestMessage(deps, { type: "state_snapshot", gameState: wire });

    const applied = deps.stateRef.current;
    expect(applied).not.toBe(wire);
    expect(applied.turnTimeRemaining).toBe(7_000);
    expect(applied.turnDeadlineAt).toBeGreaterThanOrEqual(before + 7_000);
    expect(applied.turnDeadlineAt).toBeLessThanOrEqual(
      Date.now() + 7_000 + 500,
    );
    expect(getRoom().gameState).toBe(applied);
    expect(getRoom().status).toBe("connected");
  });

  it("ignores a host-clock deadline that arrives on the wire", () => {
    const { deps } = makeDeps(baseGame());
    // An older/hostile peer may still ship its own absolute deadline —
    // it must not survive the guest-side resynthesis.
    const wire = wireGame({ turnDeadlineAt: Date.now() - 60_000 });
    const before = Date.now();

    handleGuestMessage(deps, { type: "state_snapshot", gameState: wire });

    const applied = deps.stateRef.current;
    expect(applied.turnDeadlineAt).toBeGreaterThanOrEqual(before + 7_000);
    expect(applied.turnDeadlineAt).not.toBe(wire.turnDeadlineAt);
  });

  it("clears the pending optimistic-move rollback snapshot", () => {
    const { deps } = makeDeps(baseGame());
    deps.pendingGuestStateRef.current = baseGame({ moveCount: 0 });

    handleGuestMessage(deps, { type: "state_snapshot", gameState: wireGame() });

    expect(deps.pendingGuestStateRef.current).toBeNull();
  });

  it("preserves the guest symbol — snapshots carry no symbol field", () => {
    const { deps, getRoom } = makeDeps(baseGame(), {
      guestSymbol: PlayerSymbol.O,
    });
    deps.guestSymbolRef.current = PlayerSymbol.O;

    handleGuestMessage(deps, { type: "state_snapshot", gameState: wireGame() });

    expect(deps.guestSymbolRef.current).toBe(PlayerSymbol.O);
    expect(getRoom().guestSymbol).toBe(PlayerSymbol.O);
  });

  it("keeps a live rematch prompt on a terminal snapshot", () => {
    const { deps, getRoom } = makeDeps(baseGame(), {
      rematchIncoming: true,
    });
    const wire = wireGame({
      gameStatus: GameStatus.COMPLETED,
      winner: PlayerSymbol.X,
      winningCombination: [0, 1, 2],
      // The claimed line must actually hold the winner — an empty-board
      // fixture is a payload isPeerMessage would reject, so the test
      // would exercise a path no wire frame can reach (review
      // 2026-10-03 repair P2).
      board: [
        PlayerSymbol.X,
        PlayerSymbol.X,
        PlayerSymbol.X,
        PlayerSymbol.O,
        PlayerSymbol.O,
        null,
        null,
        null,
        null,
      ],
      moves: { X: [0, 1, 2], O: [3, 4] },
      moveCount: 5,
    });
    // Pin the fixture to the wire contract: if validation ever rejects
    // this state the test would silently stop covering a reachable path.
    expect(isPeerMessage({ type: "state_snapshot", gameState: wire })).toBe(true);

    handleGuestMessage(deps, { type: "state_snapshot", gameState: wire });

    // Reconnect-sync is not part of the rematch lifecycle — the prompt
    // must survive an authoritative terminal state.
    expect(getRoom().rematchIncoming).toBe(true);
  });

  it("clears the rematch prompt once a fresh ACTIVE game arrives", () => {
    const { deps, getRoom } = makeDeps(baseGame(), {
      rematchIncoming: true,
    });

    handleGuestMessage(deps, {
      type: "gameStart",
      symbol: PlayerSymbol.X,
      gameState: wireGame(),
    });

    expect(getRoom().rematchIncoming).toBe(false);
  });
});

describe("handleGuestMessage reconnect fan-in (double-apply)", () => {
  it("applies snapshot → joined → gameUpdate in wire order and converges", () => {
    // The combined welcome path puts sync_request BEFORE the auto-join on
    // the wire, so the host's replies arrive state_snapshot first, then
    // joined/gameUpdate. Each frame is an authoritative replace — the
    // sequence must converge to the same state, not tear.
    const diverged = baseGame({ moveCount: 9 });
    const { deps, getRoom } = makeDeps(diverged, { guestSymbol: null });
    deps.guestSymbolRef.current = null;
    deps.pendingGuestStateRef.current = baseGame({ moveCount: 8 });
    const authoritative = wireGame({ moveCount: 4 });

    handleGuestMessage(deps, { type: "state_snapshot", gameState: authoritative });
    handleGuestMessage(deps, {
      type: "joined",
      symbol: PlayerSymbol.O,
      color: Color.RED,
      gameState: authoritative,
    });
    handleGuestMessage(deps, { type: "gameUpdate", gameState: authoritative });

    const applied = deps.stateRef.current;
    expect(applied.moveCount).toBe(4);
    expect(applied.board).toEqual(authoritative.board);
    expect(deps.guestSymbolRef.current).toBe(PlayerSymbol.O);
    expect(getRoom().guestSymbol).toBe(PlayerSymbol.O);
    expect(deps.pendingGuestStateRef.current).toBeNull();
    expect(getRoom().gameState).toBe(applied);
  });
});
