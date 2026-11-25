import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { builtinEnvironments } from "vitest/runtime";
import {
  clearOnlineSession,
  readOnlineSession,
  writeOnlineSession,
  type OnlineSession,
} from "./onlineSession";
import { Color, SymbolShape } from "@/game/constants";

const KEY = "tic-tac-toe:online-session";

const guestSession: OnlineSession = {
  roomId: "friday-game",
  role: "guest",
  onlineAction: "quick",
  displayName: "Maria",
  color: Color.PINK,
  playerShape: SymbolShape.STAR,
};

const stored = (value: unknown) =>
  window.sessionStorage.setItem(KEY, JSON.stringify(value));

let teardownEnvironment: (() => unknown) | undefined;

beforeAll(async () => {
  const env = await builtinEnvironments.jsdom.setup(globalThis, {});
  teardownEnvironment = () => env.teardown(globalThis);
});

afterAll(async () => {
  await teardownEnvironment?.();
});

describe("online session storage", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    window.localStorage.clear();
  });

  it("round-trips the resumption facts through sessionStorage, never localStorage", () => {
    writeOnlineSession(guestSession);

    expect(readOnlineSession()).toEqual(guestSession);
    expect(window.sessionStorage.length).toBe(1);
    expect(window.localStorage.length).toBe(0);
  });

  it("returns null when nothing is stored", () => {
    expect(readOnlineSession()).toBeNull();
  });

  it("treats unavailable storage as empty and swallows denied writes", () => {
    expect(readOnlineSession(null)).toBeNull();
    expect(() => writeOnlineSession(guestSession, null)).not.toThrow();
    expect(() => clearOnlineSession(null)).not.toThrow();
  });

  it("treats a throwing storage as denied", () => {
    const denied = {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("denied");
      },
      removeItem: () => {
        throw new Error("denied");
      },
    } as unknown as Storage;

    expect(readOnlineSession(denied)).toBeNull();
    expect(() => writeOnlineSession(guestSession, denied)).not.toThrow();
    expect(() => clearOnlineSession(denied)).not.toThrow();
  });

  it("rejects corrupted JSON", () => {
    window.sessionStorage.setItem(KEY, "{not json");
    expect(readOnlineSession()).toBeNull();
  });

  it("rejects a non-object payload", () => {
    window.sessionStorage.setItem(KEY, JSON.stringify("guest-room"));
    expect(readOnlineSession()).toBeNull();
  });

  it("rejects a wrong schema version", () => {
    for (const version of [2, "1", undefined]) {
      stored({ ...guestSession, version });
      expect(readOnlineSession(), `version ${String(version)}`).toBeNull();
    }
  });

  it("rejects missing fields", () => {
    for (const field of [
      "roomId",
      "role",
      "onlineAction",
      "displayName",
      "color",
      "playerShape",
    ] as const) {
      const { [field]: _omitted, ...rest } = { version: 1, ...guestSession };
      stored(rest);
      expect(readOnlineSession(), `missing ${field}`).toBeNull();
    }
  });

  it("rejects malformed room ids", () => {
    for (const roomId of ["", "abc", "has space", "bad!code", "x".repeat(65), 42, null]) {
      stored({ version: 1, ...guestSession, roomId });
      expect(readOnlineSession(), `roomId ${String(roomId)}`).toBeNull();
    }
  });

  it("rejects unknown enum values", () => {
    stored({ version: 1, ...guestSession, role: "admin" });
    expect(readOnlineSession()).toBeNull();

    stored({ version: 1, ...guestSession, onlineAction: "teleport" });
    expect(readOnlineSession()).toBeNull();

    stored({ version: 1, ...guestSession, color: "chartreuse" });
    expect(readOnlineSession()).toBeNull();

    stored({ version: 1, ...guestSession, playerShape: "hexagon" });
    expect(readOnlineSession()).toBeNull();
  });

  it("rejects a display name the lobby would not accept", () => {
    for (const displayName of ["", "x", "  ", "bad\u200Bname", 7]) {
      stored({ version: 1, ...guestSession, displayName });
      expect(readOnlineSession(), `displayName ${String(displayName)}`).toBeNull();
    }
  });

  it("ignores fields it does not know", () => {
    stored({ version: 1, ...guestSession, futureField: { nested: true } });
    expect(readOnlineSession()).toEqual(guestSession);
  });

  it("refuses to write facts that would not read back", () => {
    writeOnlineSession({ ...guestSession, roomId: "bad id!" });
    expect(readOnlineSession()).toBeNull();
    expect(window.sessionStorage.length).toBe(0);
  });

  it("clears the stored session", () => {
    writeOnlineSession(guestSession);
    expect(readOnlineSession()).not.toBeNull();

    clearOnlineSession();
    expect(readOnlineSession()).toBeNull();
    expect(window.sessionStorage.length).toBe(0);
  });
});
