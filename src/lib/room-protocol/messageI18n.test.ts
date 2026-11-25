import { afterEach, describe, expect, it, vi } from "vitest";
import {
  Color,
  GameModes,
  GameStatus,
  PlayerSymbol,
  type PlayerSettings,
} from "@/game/constants";
import { createInitialGameState, freshGameState, type GameState } from "@/game/logic";
import { setLocale, t } from "@/i18n/language";
import { peerLeftMessageKey, peerLeftUserMessage } from "@/lib/peer.apply";
import { RoomClient } from "@/lib/roomClient";
import { buildRoomClient, type RoomLifecycleDeps } from "./roomLifecycle";
import { handleRelayEvent, type RelayEventDeps } from "./relayEvents";
import { handleGuestMessage, type GuestProtocolDeps } from "./guestProtocol";
import { clearedMessage, keyedMessage, statusMessageText } from "./messageI18n";
import type { PeerRole, PeerRoomState } from "./state";

vi.mock("@/lib/errorReporting", () => ({ reportError: vi.fn() }));

function roomState(overrides: Partial<PeerRoomState> = {}): PeerRoomState {
  return {
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
    gameState: freshGameState(),
    ...overrides,
  };
}

function completedGame(): GameState {
  const game = createInitialGameState({
    gameMode: GameModes.ONLINE,
    playerXName: "Ada",
    playerOName: "Bob",
    playerColor: Color.BLUE,
    opponentColor: Color.RED,
    humanSymbol: PlayerSymbol.X,
  });
  game.gameStatus = GameStatus.COMPLETED;
  game.winner = PlayerSymbol.X;
  return game;
}

function lifecycleDeps(): RoomLifecycleDeps {
  return {
    roomRef: { current: null },
    stateRef: { current: freshGameState() },
    roleRef: { current: null },
    quickMatchHostRef: { current: false },
    hostSymbolRef: { current: null },
    guestSymbolRef: { current: null },
    hostDisplayName: "Host",
    hostColor: Color.BLUE,
    setState: vi.fn(),
    update: vi.fn(),
    handleWsEvent: vi.fn(),
    handleHostData: vi.fn(),
    handleGuestData: vi.fn(),
    stopTimer: vi.fn(),
    rematchPendingRef: { current: false },
    lastSyncReplyAtRef: { current: 0 },
    guestJoinedRef: { current: false },
    hostPendingSettingsRef: { current: null as PlayerSettings | null },
    reconnectResetsRef: { current: { moveCount: -1 } },
    pendingGuestStateRef: { current: null as GameState | null },
    syncPendingRef: { current: false },
    waitingForHostTimeoutRef: { current: null },
    waitingForHostDeadlineAtRef: { current: null },
  };
}

function relayDeps(role: PeerRole) {
  let roomStateValue = roomState({ role, status: "connected" });
  const deps: RelayEventDeps = {
    roomRef: { current: null },
    stateRef: { current: freshGameState() },
    roleRef: { current: role },
    quickMatchHostRef: { current: false },
    hostSymbolRef: { current: PlayerSymbol.X },
    guestSymbolRef: { current: PlayerSymbol.O },
    rematchPendingRef: { current: false },
    reconnectResetsRef: { current: { moveCount: -1 } },
    waitingForHostTimeoutRef: { current: null },
    waitingForHostDeadlineAtRef: { current: null },
    pausedRef: { current: false },
    setState: (updater) => {
      roomStateValue =
        typeof updater === "function" ? updater(roomStateValue) : updater;
    },
    commitHostState: vi.fn(),
    broadcastGameState: vi.fn(),
    requestSync: vi.fn(),
    startTimer: vi.fn(),
    stopTimer: vi.fn(),
    clearRematchTimeout: vi.fn(),
  };
  return { deps, getRoom: () => roomStateValue };
}

function guestDeps(game: GameState, roomInit: Partial<PeerRoomState> = {}) {
  let roomStateValue = { gameState: game, status: "connected", ...roomInit } as PeerRoomState;
  const deps: GuestProtocolDeps = {
    stateRef: { current: game },
    guestSymbolRef: { current: PlayerSymbol.O },
    pendingGuestStateRef: { current: null },
    rematchPendingRef: { current: false },
    syncPendingRef: { current: false },
    setState: (updater) => {
      roomStateValue =
        typeof updater === "function" ? updater(roomStateValue) : updater;
    },
    stopTimer: vi.fn(),
    clearRematchTimeout: vi.fn(),
    onHostPause: vi.fn(),
  };
  return { deps, getRoom: () => roomStateValue };
}

afterEach(() => {
  setLocale("en");
  vi.restoreAllMocks();
});

describe("keyed message re-resolution", () => {
  it("re-renders a keyed line in the new language while the copy stays put", () => {
    const written = keyedMessage("mm.reconnecting");

    expect(written.message).toBe("Reconnecting...");
    expect(statusMessageText(written)).toBe("Reconnecting...");

    setLocale("es");

    expect(statusMessageText(written)).toBe("Reconectando...");
    expect(written.message).toBe("Reconnecting...");
  });

  it("keeps the interpolated name when the line is re-resolved", () => {
    const written = keyedMessage("peer.wantsRematch", { name: "Ada" });

    expect(written.message).toBe("Ada wants a rematch. Accept or decline below.");

    setLocale("es");

    expect(statusMessageText(written)).toBe(
      "Ada quiere la revancha. Acepta o rechaza abajo.",
    );
    expect(written.messageVars).toEqual({ name: "Ada" });
  });

  it("clears the key, the vars and the text together", () => {
    const cleared = clearedMessage();

    expect(cleared.message).toBe("");
    expect(cleared.messageKey).toBeNull();
    expect(cleared.messageVars).toBeUndefined();
    expect(statusMessageText(cleared)).toBe("");
  });

  it("renders unkeyed legacy prose unchanged", () => {
    expect(statusMessageText({ message: "Socket dropped" })).toBe("Socket dropped");
    setLocale("es");
    expect(statusMessageText({ message: "Socket dropped" })).toBe("Socket dropped");
  });

  it("maps every peer-left combination onto the copy it renders", () => {
    for (const role of ["host", "guest"] as const) {
      for (const reason of ["disconnect", "closed", "expired"] as const) {
        const key = peerLeftMessageKey(role, reason);
        expect(statusMessageText(keyedMessage(key))).toBe(
          peerLeftUserMessage(role, reason),
        );
      }
    }
  });
});

describe("producer integrations", () => {
  it("the transport reconnecting path writes the mm.reconnecting key", () => {
    const deps = lifecycleDeps();
    let handler: ((status: string, detail?: string) => void) | undefined;
    vi.spyOn(RoomClient.prototype, "setStatusHandler").mockImplementation(
      ((h: (status: string, detail?: string) => void) => {
        handler = h;
      }) as never,
    );
    vi.spyOn(RoomClient.prototype, "setMessageHandler").mockImplementation(
      (() => undefined) as never,
    );

    buildRoomClient(deps, "ws://relay.test/room", "guest");
    handler?.("reconnecting", "Reconnecting in 1.2s");

    const updater = (deps.setState as unknown as { mock: { calls: unknown[][] } })
      .mock.calls.at(-1)?.[0] as (p: PeerRoomState) => PeerRoomState;
    const next = updater(roomState());

    expect(next.messageKey).toBe("mm.reconnecting");
    expect(next.message).toBe(t("mm.reconnecting"));
  });

  it("the relay peer-left path writes the matching peer-left key", () => {
    const host = relayDeps("host");
    handleRelayEvent(host.deps, { type: "peer-left", reason: "closed" });
    expect(host.getRoom().messageKey).toBe("peer.opponentLeftRoom");

    const guest = relayDeps("guest");
    handleRelayEvent(guest.deps, { type: "peer-left", reason: "closed" });
    expect(guest.getRoom().messageKey).toBe("peer.hostLeftRoom");
  });

  it("the guest pause stashes and restores a keyed rematch message", () => {
    const { deps, getRoom } = guestDeps(completedGame(), {
      message: "Ada wants a rematch. Accept or decline below.",
      messageKey: "peer.wantsRematch",
      messageVars: { name: "Ada" },
    });

    handleGuestMessage(deps, { type: "pause", paused: true });

    expect(getRoom().messageKey).toBe("peer.hostPaused");
    expect(getRoom().pausedStash?.messageKey).toBe("peer.wantsRematch");
    expect(getRoom().pausedStash?.messageVars).toEqual({ name: "Ada" });

    handleGuestMessage(deps, { type: "pause", paused: false });

    expect(getRoom().messageKey).toBe("peer.wantsRematch");
    expect(getRoom().messageVars).toEqual({ name: "Ada" });
  });

  it("the rematch request writes its key and the requesting player's name", () => {
    const { deps, getRoom } = guestDeps(completedGame());

    handleGuestMessage(deps, {
      type: "rematchRequested",
      requesterSymbol: PlayerSymbol.X,
    });

    expect(getRoom().messageKey).toBe("peer.wantsRematch");
    expect(getRoom().messageVars).toEqual({ name: "Ada" });
    expect(getRoom().message).toBe(t("peer.wantsRematch", { name: "Ada" }));
  });
});
