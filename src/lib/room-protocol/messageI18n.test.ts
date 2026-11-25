import { afterEach, describe, expect, it } from "vitest";
import { freshGameState } from "@/game/logic";
import { setLocale } from "@/i18n/language";
import { peerMessage, type PeerRoomState } from "./state";

afterEach(() => {
  setLocale("en");
});

function roomState(overrides: Partial<PeerRoomState> = {}): PeerRoomState {
  return {
    role: "host",
    status: "reconnecting",
    queue: "none",
    roomId: "ROOM42",
    hostSymbol: null,
    guestSymbol: null,
    messageKey: null,
    pausedStash: null,
    rematchIncoming: false,
    rematchOutgoing: false,
    leftBySelf: false,
    canRetryReconnect: false,
    gameState: freshGameState(),
    ...overrides,
  };
}

describe("room-protocol status lines", () => {
  it("reads the stored key in the language that is current when it is read", () => {
    setLocale("en");
    const state = roomState({ messageKey: "mm.reconnecting" });
    expect(peerMessage(state)).toBe("Reconnecting...");

    setLocale("es");
    expect(peerMessage(state)).toBe("Reconectando...");
  });

  it("keeps no translated copy of its own", () => {
    const state = roomState({ messageKey: "mm.reconnecting" });
    expect(JSON.stringify(state)).not.toContain("Reconnecting");
  });

  it("interpolates the stored variables in the current language", () => {
    setLocale("en");
    const state = roomState({
      messageKey: "peer.wantsRematch",
      messageVars: { name: "Ada" },
    });
    expect(peerMessage(state)).toBe(
      "Ada wants a rematch. Accept or decline below.",
    );

    setLocale("es");
    expect(peerMessage(state)).toBe(
      "Ada quiere la revancha. Acepta o rechaza abajo.",
    );
  });

  it("has no line when the protocol stored no key", () => {
    expect(peerMessage(roomState({ messageKey: null }))).toBe("");
  });
});
