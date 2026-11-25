import { describe, it, expect, vi } from "vitest";
import {
  Color,
  GameModes,
  GameStatus,
  PlayerSymbol,
  TURN_DURATION_MS,
} from "@/game/constants";
import { createInitialGameState, makeMove } from "@/game/logic";
import type { GameState } from "@/game/logic";
import type { RoomClient } from "@/lib/roomClient";
import { isPeerMessage, type PeerMessage } from "@/lib/peer.wire";
import type { PeerRoomState } from "./state";
import {
  handleHostMessage,
  SYNC_REPLY_COOLDOWN_MS,
  type HostProtocolDeps,
} from "./hostProtocol";

const FROZEN_REMAINING = 4_000;

function onlineGame(overrides: Partial<GameState> = {}): GameState {
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

function midGame(): GameState {
  let state = onlineGame();
  state = makeMove(state, 0)!;
  state = makeMove(state, 4)!;
  state = makeMove(state, 8)!;
  return state;
}

function pausedMidGame(): GameState {
  return {
    ...midGame(),
    turnTimeRemaining: FROZEN_REMAINING,
    turnDeadlineAt: Date.now() - 60_000,
  };
}

function waitingGame(): GameState {
  return { ...onlineGame(), gameStatus: GameStatus.WAITING };
}

function makeDeps(game: GameState) {
  let roomState = { gameState: game } as PeerRoomState;
  const deps: HostProtocolDeps = {
    stateRef: { current: game },
    roomRef: { current: { send: vi.fn() } as unknown as RoomClient },
    hostSymbolRef: { current: PlayerSymbol.X },
    rematchPendingRef: { current: false },
    lastSyncReplyAtRef: { current: -SYNC_REPLY_COOLDOWN_MS },
    guestJoinedRef: { current: true },
    reconnectResetsRef: { current: { moveCount: -1 } },
    hostPendingSettingsRef: { current: null },
    pausedRef: { current: false },
    setState: (updater) => {
      roomState = typeof updater === "function" ? updater(roomState) : updater;
    },
    commitHostState: (g) => {
      deps.stateRef.current = g;
      roomState = { ...roomState, gameState: g };
    },
    broadcastGameState: vi.fn(),
    stopTimer: vi.fn(),
    clearRematchTimeout: vi.fn(),
  };
  return { deps, getRoom: () => roomState };
}

function sentFrames(deps: HostProtocolDeps): PeerMessage[] {
  return (deps.roomRef.current!.send as ReturnType<typeof vi.fn>).mock.calls.map(
    ([frame]) => frame as PeerMessage,
  );
}

describe("handleHostMessage join while the host is paused", () => {
  it("resync join sends joined + gameUpdate with the frozen remaining, then pause", () => {
    const game = pausedMidGame();
    const { deps } = makeDeps(game);
    deps.pausedRef.current = true;

    handleHostMessage(deps, {
      type: "join",
      displayName: "guest",
      guestId: "g-1",
    });

    const frames = sentFrames(deps);
    expect(frames.map((frame) => frame.type)).toEqual([
      "joined",
      "gameUpdate",
      "pause",
    ]);
    const [joined, update, pause] = frames as [
      Extract<PeerMessage, { type: "joined" }>,
      Extract<PeerMessage, { type: "gameUpdate" }>,
      Extract<PeerMessage, { type: "pause" }>,
    ];
    expect(joined.gameState.turnTimeRemaining).toBe(FROZEN_REMAINING);
    expect(joined.gameState.turnDeadlineAt).toBeUndefined();
    expect(update.gameState.turnTimeRemaining).toBe(FROZEN_REMAINING);
    expect(pause).toEqual({ type: "pause", paused: true });
    for (const frame of frames) {
      expect(isPeerMessage(frame)).toBe(true);
    }
    expect(deps.stateRef.current).toBe(game);
    expect(deps.stateRef.current.turnDeadlineAt).toBe(game.turnDeadlineAt);
    expect(deps.reconnectResetsRef.current.moveCount).toBe(-1);
  });

  it("fresh join while paused sends joined + gameStart with a full clock, then pause", () => {
    const { deps } = makeDeps(waitingGame());
    deps.pausedRef.current = true;

    handleHostMessage(deps, {
      type: "join",
      displayName: "guest",
      guestId: "g-1",
    });

    const frames = sentFrames(deps);
    expect(frames.map((frame) => frame.type)).toEqual([
      "joined",
      "gameStart",
      "pause",
    ]);
    const [joined, start, pause] = frames as [
      Extract<PeerMessage, { type: "joined" }>,
      Extract<PeerMessage, { type: "gameStart" }>,
      Extract<PeerMessage, { type: "pause" }>,
    ];
    expect(joined.gameState.turnTimeRemaining).toBe(TURN_DURATION_MS);
    expect(start.gameState.turnTimeRemaining).toBe(TURN_DURATION_MS);
    expect(pause).toEqual({ type: "pause", paused: true });
    for (const frame of frames) {
      expect(isPeerMessage(frame)).toBe(true);
    }
  });
});

describe("handleHostMessage sync_request while the host is paused", () => {
  it("replies state_snapshot with the frozen remaining, then pause", () => {
    const game = pausedMidGame();
    const { deps } = makeDeps(game);
    deps.pausedRef.current = true;

    handleHostMessage(deps, { type: "sync_request" });

    const frames = sentFrames(deps);
    expect(frames.map((frame) => frame.type)).toEqual([
      "state_snapshot",
      "pause",
    ]);
    const [snapshot, pause] = frames as [
      Extract<PeerMessage, { type: "state_snapshot" }>,
      Extract<PeerMessage, { type: "pause" }>,
    ];
    expect(snapshot.gameState.turnTimeRemaining).toBe(FROZEN_REMAINING);
    expect(snapshot.gameState.turnDeadlineAt).toBeUndefined();
    expect(snapshot.symbol).toBe(PlayerSymbol.O);
    expect(pause).toEqual({ type: "pause", paused: true });
    for (const frame of frames) {
      expect(isPeerMessage(frame)).toBe(true);
    }
    expect(deps.stateRef.current).toBe(game);
  });
});

describe("unpaused join and sync resync stay unchanged", () => {
  it("resync join recomputes remaining from the live deadline and sends no pause", () => {
    const game: GameState = {
      ...midGame(),
      turnTimeRemaining: FROZEN_REMAINING,
      turnDeadlineAt: Date.now() + 8_000,
    };
    const { deps } = makeDeps(game);
    deps.reconnectResetsRef.current.moveCount = game.moveCount;

    handleHostMessage(deps, {
      type: "join",
      displayName: "guest",
      guestId: "g-1",
    });

    const frames = sentFrames(deps);
    expect(frames.map((frame) => frame.type)).toEqual([
      "joined",
      "gameUpdate",
    ]);
    const [, update] = frames as [
      Extract<PeerMessage, { type: "joined" }>,
      Extract<PeerMessage, { type: "gameUpdate" }>,
    ];
    expect(update.gameState.turnTimeRemaining).toBeGreaterThan(FROZEN_REMAINING);
    expect(update.gameState.turnTimeRemaining).toBeLessThanOrEqual(8_000);
    expect(deps.stateRef.current.turnDeadlineAt).toBe(game.turnDeadlineAt);
  });

  it("sync_request recomputes remaining from the live deadline and sends no pause", () => {
    const game: GameState = {
      ...midGame(),
      turnTimeRemaining: FROZEN_REMAINING,
      turnDeadlineAt: Date.now() + 8_000,
    };
    const { deps } = makeDeps(game);

    handleHostMessage(deps, { type: "sync_request" });

    const frames = sentFrames(deps);
    expect(frames.map((frame) => frame.type)).toEqual(["state_snapshot"]);
    const [snapshot] = frames as [Extract<PeerMessage, { type: "state_snapshot" }>];
    expect(snapshot.gameState.turnTimeRemaining).toBeGreaterThan(FROZEN_REMAINING);
    expect(snapshot.gameState.turnTimeRemaining).toBeLessThanOrEqual(8_000);
    expect(deps.stateRef.current).toBe(game);
  });
});
