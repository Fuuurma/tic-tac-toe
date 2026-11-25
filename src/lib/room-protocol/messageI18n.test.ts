import { afterEach, describe, expect, it } from "vitest";
import { setLocale, t } from "@/i18n/language";
import { peerLeftMessageKey, peerLeftUserMessage } from "@/lib/peer.apply";
import {
  clearedMessage,
  keyedMessage,
  statusMessageText,
} from "./messageI18n";

// The online status banners (reconnecting, disconnected, waiting, error)
// used to store write-time prose in PeerRoomState.message, so a language
// switch left them frozen in the old locale. The state now stores the
// dictionary key + vars; the surface re-translates on every render.

afterEach(() => {
  setLocale("en");
});

describe("keyedMessage", () => {
  it("stores the key and vars and derives message for tests", () => {
    setLocale("en");
    const m = keyedMessage("peer.wantsRematch", { name: "Ana" });

    expect(m.messageKey).toBe("peer.wantsRematch");
    expect(m.messageVars).toEqual({ name: "Ana" });
    expect(m.message).toBe("Ana wants a rematch. Accept or decline below.");
  });
});

describe("statusMessageText", () => {
  it("retranslates a reconnecting line written in English after the locale switches to Spanish", () => {
    setLocale("en");
    const m = keyedMessage("mm.reconnecting");
    expect(statusMessageText(m)).toBe("Reconnecting...");
    expect(m.message).toBe("Reconnecting...");

    setLocale("es");
    expect(statusMessageText(m)).toBe("Reconectando...");
    // The derived copy stays frozen at write time — that is what tests
    // and non-React readers see; the UI must render statusMessageText.
    expect(m.message).toBe("Reconnecting...");
  });

  it("interpolates vars in the new locale", () => {
    setLocale("en");
    const m = keyedMessage("peer.wantsRematch", { name: "Ana" });
    expect(statusMessageText(m)).toContain("Ana");

    setLocale("es");
    expect(statusMessageText(m)).toBe(
      "Ana quiere la revancha. Acepta o rechaza abajo.",
    );
  });

  it("retranslates a peer-left reason in the new locale", () => {
    setLocale("en");
    const m = keyedMessage(peerLeftMessageKey("guest", "closed"));
    expect(statusMessageText(m)).toBe("Host left the room");

    setLocale("es");
    expect(statusMessageText(m)).not.toBe("Host left the room");
    expect(statusMessageText(m)).toBe(t("peer.hostLeftRoom"));
  });
});

describe("clearedMessage", () => {
  it("clears the key, vars and derived text together", () => {
    const m = clearedMessage();

    expect(m.messageKey).toBeNull();
    expect(m.messageVars).toBeUndefined();
    expect(m.message).toBe("");
    expect(statusMessageText(m)).toBe("");
  });
});

describe("statusMessageText fallbacks", () => {
  it("renders write-time prose for states that carry no key", () => {
    // Test fixtures and any legacy write hold `message` without a key.
    expect(statusMessageText({ message: "Socket dropped" })).toBe(
      "Socket dropped",
    );
    expect(statusMessageText({ messageKey: null, message: "" })).toBe("");
    expect(statusMessageText({})).toBe("");
  });
});

describe("peerLeftMessageKey", () => {
  it("agrees with peerLeftUserMessage for every role and reason", () => {
    for (const role of ["host", "guest"] as const) {
      for (const reason of ["disconnect", "closed", "expired"] as const) {
        expect(t(peerLeftMessageKey(role, reason))).toBe(
          peerLeftUserMessage(role, reason),
        );
      }
    }
  });
});
