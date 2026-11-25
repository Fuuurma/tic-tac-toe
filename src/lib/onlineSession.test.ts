import { describe, expect, it } from "vitest";
import {
  AI_Difficulty,
  Color,
  GameModes,
  PlayerTypes,
  SymbolShape,
  oppositeColor,
} from "@/game/constants";
import {
  clearOnlineSession,
  gameSetupFromOnlineSession,
  ONLINE_SESSION_STORAGE_KEY,
  readOnlineSession,
  writeOnlineSession,
  type OnlineSession,
} from "./onlineSession";

const validSession: OnlineSession = {
  roomId: "ROOM42-abc_xyz",
  role: "guest",
  onlineAction: "join",
  displayName: "Maria",
  color: Color.PINK,
  playerShape: SymbolShape.STAR,
};

function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (key: string) => map.get(key) ?? null,
    key: (index: number) => [...map.keys()][index] ?? null,
    removeItem: (key: string) => {
      map.delete(key);
    },
    setItem: (key: string, value: string) => {
      map.set(key, String(value));
    },
  };
}

function throwingStorage(): Storage {
  return {
    get length() {
      return 0;
    },
    clear: () => {},
    getItem: () => {
      throw new Error("SecurityError: storage is disabled");
    },
    key: () => null,
    removeItem: () => {},
    setItem: () => {
      throw new Error("QuotaExceededError");
    },
  };
}

function storedJson(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    version: 1,
    roomId: validSession.roomId,
    role: validSession.role,
    onlineAction: validSession.onlineAction,
    displayName: validSession.displayName,
    color: validSession.color,
    playerShape: validSession.playerShape,
    ...overrides,
  });
}

describe("onlineSession storage access", () => {
  it("reads null and writes/clears as no-ops when storage is unavailable", () => {
    expect(readOnlineSession(null)).toBeNull();
    expect(() => writeOnlineSession(validSession, null)).not.toThrow();
    expect(() => clearOnlineSession(null)).not.toThrow();
  });

  it("survives a storage whose accessors throw", () => {
    const storage = throwingStorage();
    expect(readOnlineSession(storage)).toBeNull();
    expect(() => writeOnlineSession(validSession, storage)).not.toThrow();
    expect(() => clearOnlineSession(storage)).not.toThrow();
  });
});

describe("onlineSession round trip", () => {
  it("writes the resumption facts and reads them back without the envelope version", () => {
    const storage = memoryStorage();
    writeOnlineSession(validSession, storage);

    const raw = storage.getItem(ONLINE_SESSION_STORAGE_KEY);
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw as string).version).toBe(1);

    const read = readOnlineSession(storage);
    expect(read).toEqual(validSession);
    expect(read && "version" in read).toBe(false);
  });

  it("does not mutate the session object it is given", () => {
    const storage = memoryStorage();
    const session = { ...validSession };
    writeOnlineSession(session, storage);
    expect(session).toEqual(validSession);
  });
});

describe("onlineSession read rejection", () => {
  const rejects = (raw: string | null) => {
    const storage = memoryStorage();
    if (raw !== null) storage.setItem(ONLINE_SESSION_STORAGE_KEY, raw);
    expect(readOnlineSession(storage)).toBeNull();
    if (raw !== null) {
      expect(storage.getItem(ONLINE_SESSION_STORAGE_KEY)).toBe(raw);
    }
  };

  it("rejects missing and non-JSON values", () => {
    rejects(null);
    rejects("");
    rejects("not json {");
    rejects('"just a string"');
    rejects("42");
    rejects("true");
    rejects("null");
  });

  it("rejects non-object JSON", () => {
    rejects("[]");
    rejects("[1,2,3]");
    rejects('{"nested":{"deep":true}}');
  });

  it("rejects wrong or missing versions", () => {
    rejects(storedJson({ version: 2 }));
    rejects(storedJson({ version: 0 }));
    rejects(storedJson({ version: "1" }));
    rejects(JSON.stringify({ roomId: validSession.roomId }));
  });

  it("rejects malformed room ids, including ones only valid after normalization", () => {
    for (const roomId of [
      "  ROOM42-abc_xyz  ",
      " ROOM42-abc_xyz",
      "ROOM42-abc_xyz ",
      "ROOM 42",
      "ab",
      "a".repeat(65),
      "room\nid",
      "room.id",
      "",
      12345,
      null,
    ]) {
      rejects(storedJson({ roomId }));
    }
  });

  it("rejects unknown role and action values", () => {
    for (const role of ["admin", "HOST", "", null, 1]) {
      rejects(storedJson({ role }));
    }
    for (const onlineAction of ["createe", "QUICK", "", null, 7]) {
      rejects(storedJson({ onlineAction }));
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
    ]) {
      const parsed = JSON.parse(storedJson()) as Record<string, unknown>;
      delete parsed[field];
      rejects(JSON.stringify(parsed));
    }
  });

  it("rejects display names that are empty or not canonically sanitized", () => {
    for (const displayName of [
      "",
      "   ",
      " Jo",
      "Jo ",
      "Jo  Public",
      "J",
      "x".repeat(21),
      "bad\u200bname",
      "a<b",
      null,
      42,
    ]) {
      rejects(storedJson({ displayName }));
    }
  });

  it("accepts canonical display names", () => {
    const storage = memoryStorage();
    writeOnlineSession({ ...validSession, displayName: "Crimson Fox" }, storage);
    expect(readOnlineSession(storage)?.displayName).toBe("Crimson Fox");
  });

  it("rejects unknown colors and legacy or unknown shapes", () => {
    for (const color of ["magenta", "BLUE", "", null, 3]) {
      rejects(storedJson({ color }));
    }
    for (const playerShape of ["hexagon", "circle", "STAR", "", null]) {
      rejects(storedJson({ playerShape }));
    }
  });
});

describe("onlineSession writes", () => {
  it("is a no-op for invalid sessions", () => {
    const storage = memoryStorage();
    const invalid = [
      { ...validSession, roomId: " bad " },
      { ...validSession, role: "admin" },
      { ...validSession, onlineAction: "warp" },
      { ...validSession, displayName: "" },
      { ...validSession, displayName: "not  canonical" },
      { ...validSession, color: "magenta" },
      { ...validSession, playerShape: "hexagon" },
      { ...validSession, roomId: "" },
    ];
    for (const session of invalid) {
      writeOnlineSession(session as OnlineSession, storage);
      expect(storage.getItem(ONLINE_SESSION_STORAGE_KEY)).toBeNull();
    }
  });
});

describe("onlineSession clear", () => {
  it("removes only its own key", () => {
    const storage = memoryStorage();
    storage.setItem("tic-tac-toe:preferences", "{}");
    writeOnlineSession(validSession, storage);

    clearOnlineSession(storage);

    expect(storage.getItem(ONLINE_SESSION_STORAGE_KEY)).toBeNull();
    expect(storage.getItem("tic-tac-toe:preferences")).toBe("{}");
    expect(readOnlineSession(storage)).toBeNull();
  });

  it("is a no-op when nothing is stored", () => {
    const storage = memoryStorage();
    expect(() => clearOnlineSession(storage)).not.toThrow();
    expect(storage.length).toBe(0);
  });
});

describe("gameSetupFromOnlineSession", () => {
  it("builds an online setup carrying the stored facts and resumeRole", () => {
    const setup = gameSetupFromOnlineSession({
      ...validSession,
      onlineAction: "quick",
    });

    expect(setup).toEqual({
      displayName: validSession.displayName,
      color: validSession.color,
      opponentColor: oppositeColor(validSession.color),
      playerShape: validSession.playerShape,
      opponentShape: SymbolShape.O,
      gameMode: GameModes.ONLINE,
      aiDifficulty: AI_Difficulty.NORMAL,
      opponentName: "",
      opponentType: PlayerTypes.HUMAN,
      onlineRoomId: validSession.roomId,
      onlineAction: "quick",
      resumeRole: "guest",
    });
  });
});
