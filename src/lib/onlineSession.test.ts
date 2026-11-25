import { afterEach, describe, expect, it } from "vitest";
import {
  clearOnlineSession,
  ONLINE_SESSION_KEY,
  readOnlineSession,
  writeOnlineSession,
  type OnlineSession,
} from "./onlineSession";

const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");

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

function installWindow(storage: Storage) {
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { sessionStorage: storage },
  });
}

function throwingStorage(): Storage {
  return {
    get length() {
      return 0;
    },
    clear: () => {},
    getItem: () => {
      throw new Error("SecurityError");
    },
    key: () => null,
    removeItem: () => {
      throw new Error("SecurityError");
    },
    setItem: () => {
      throw new Error("QuotaExceededError");
    },
  };
}

afterEach(() => {
  if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
  else Reflect.deleteProperty(globalThis, "window");
});

const guestSession: OnlineSession = {
  roomId: "ROOM-1234",
  role: "guest",
  onlineAction: "join",
  displayName: "Nova Fox",
  color: "pink",
  playerShape: "star",
};

describe("onlineSession round trip", () => {
  it("writes and reads back the resumption facts through the default storage", () => {
    installWindow(memoryStorage());

    writeOnlineSession(guestSession);

    expect(readOnlineSession()).toEqual(guestSession);
  });

  it("accepts an injected storage", () => {
    const storage = memoryStorage();

    writeOnlineSession(guestSession, storage);

    expect(readOnlineSession(storage)).toEqual(guestSession);
  });

  it("stamps the payload with a schema version the read does not return", () => {
    const storage = memoryStorage();

    writeOnlineSession(guestSession, storage);

    const raw = JSON.parse(storage.getItem(ONLINE_SESSION_KEY) ?? "null");
    expect(raw.version).toBe(1);
    expect(readOnlineSession(storage)).not.toHaveProperty("version");
  });

  it("overwrites a previous session on write", () => {
    const storage = memoryStorage();
    writeOnlineSession(guestSession, storage);

    writeOnlineSession({ ...guestSession, roomId: "ROOM-9999" }, storage);

    expect(readOnlineSession(storage)?.roomId).toBe("ROOM-9999");
  });

  it("tolerates fields a newer build may add", () => {
    const storage = memoryStorage();
    storage.setItem(
      ONLINE_SESSION_KEY,
      JSON.stringify({ version: 1, ...guestSession, futureField: { nested: true } }),
    );

    expect(readOnlineSession(storage)).toEqual(guestSession);
  });

  it("reads a host-role session — the schema carries it for the next slice", () => {
    const storage = memoryStorage();
    storage.setItem(
      ONLINE_SESSION_KEY,
      JSON.stringify({ version: 1, ...guestSession, role: "host", onlineAction: "create" }),
    );

    expect(readOnlineSession(storage)).toEqual({
      ...guestSession,
      role: "host",
      onlineAction: "create",
    });
  });
});

describe("onlineSession when storage is unavailable", () => {
  it("reads null and writes/clears are no-ops without a window", () => {
    Reflect.deleteProperty(globalThis, "window");

    expect(readOnlineSession()).toBeNull();
    expect(() => writeOnlineSession(guestSession)).not.toThrow();
    expect(() => clearOnlineSession()).not.toThrow();
  });

  it("treats an explicitly null storage as denied", () => {
    expect(readOnlineSession(null)).toBeNull();
    expect(() => writeOnlineSession(guestSession, null)).not.toThrow();
    expect(() => clearOnlineSession(null)).not.toThrow();
  });

  it("survives a storage whose accessors throw", () => {
    const storage = throwingStorage();

    expect(readOnlineSession(storage)).toBeNull();
    expect(() => writeOnlineSession(guestSession, storage)).not.toThrow();
    expect(() => clearOnlineSession(storage)).not.toThrow();
  });
});

describe("onlineSession malformed payloads", () => {
  const seed = (raw: string) => {
    const storage = memoryStorage();
    storage.setItem(ONLINE_SESSION_KEY, raw);
    return storage;
  };

  it("rejects non-JSON and non-object payloads", () => {
    for (const raw of ["not json{", "", "null", "42", '"text"', "true", "[]", "[1,2]"]) {
      expect(readOnlineSession(seed(raw))).toBeNull();
    }
  });

  it("rejects a missing or wrong schema version", () => {
    for (const version of [undefined, 0, 2, "1", null]) {
      const payload: Record<string, unknown> = { version, ...guestSession };
      if (version === undefined) delete payload.version;
      expect(readOnlineSession(seed(JSON.stringify(payload)))).toBeNull();
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
      const payload: Record<string, unknown> = { version: 1, ...guestSession };
      delete payload[field];
      expect(readOnlineSession(seed(JSON.stringify(payload)))).toBeNull();
    }
  });

  it("rejects malformed room ids, including ones only normalization would fix", () => {
    for (const roomId of [
      "",
      "abc",
      "has space",
      "semi;colon",
      " ROOM-1234",
      "ROOM-1234 ",
      "ROOM-1234\n",
      "ROOM 1234",
      "x".repeat(65),
      42,
      null,
    ]) {
      expect(
        readOnlineSession(seed(JSON.stringify({ version: 1, ...guestSession, roomId }))),
      ).toBeNull();
    }
  });

  it("rejects unknown role and action values", () => {
    for (const role of ["admin", "spectator", "", null, 1]) {
      expect(
        readOnlineSession(seed(JSON.stringify({ version: 1, ...guestSession, role }))),
      ).toBeNull();
    }
    for (const onlineAction of ["spectate", "", null, 1]) {
      expect(
        readOnlineSession(
          seed(JSON.stringify({ version: 1, ...guestSession, onlineAction })),
        ),
      ).toBeNull();
    }
  });

  it("rejects unknown colors, legacy shapes and non-canonical names", () => {
    for (const color of ["chartreuse", "BLUE", " blue", "", null, 1]) {
      expect(
        readOnlineSession(seed(JSON.stringify({ version: 1, ...guestSession, color }))),
      ).toBeNull();
    }
    for (const playerShape of ["hexagon", "HEXAGON", "blob", "", null, 1]) {
      expect(
        readOnlineSession(
          seed(JSON.stringify({ version: 1, ...guestSession, playerShape })),
        ),
      ).toBeNull();
    }
    for (const displayName of [
      "",
      "   ",
      " Nova Fox",
      "Nova Fox ",
      "Nova  Fox",
      "Nova\u200BFox",
      "A",
      "ABCDEFGHIJKLMNOPQRSTU",
      null,
      42,
    ]) {
      expect(
        readOnlineSession(
          seed(JSON.stringify({ version: 1, ...guestSession, displayName })),
        ),
      ).toBeNull();
    }
  });
});

describe("onlineSession invalid writes", () => {
  it("are a no-op and store nothing", () => {
    const cases: OnlineSession[] = [
      { ...guestSession, roomId: " ROOM-1234" },
      { ...guestSession, roomId: "has space" },
      { ...guestSession, displayName: " Nova Fox" },
      { ...guestSession, displayName: "" },
      { ...guestSession, role: "admin" as OnlineSession["role"] },
      { ...guestSession, onlineAction: "spectate" as OnlineSession["onlineAction"] },
      { ...guestSession, color: "chartreuse" as OnlineSession["color"] },
      { ...guestSession, playerShape: "hexagon" as OnlineSession["playerShape"] },
    ];

    for (const session of cases) {
      const storage = memoryStorage();
      writeOnlineSession(session, storage);
      expect(storage.getItem(ONLINE_SESSION_KEY)).toBeNull();
      expect(readOnlineSession(storage)).toBeNull();
    }
  });
});

describe("onlineSession immutability", () => {
  it("returns a copy — mutating the result cannot rewrite storage", () => {
    const storage = memoryStorage();
    writeOnlineSession(guestSession, storage);
    const before = storage.getItem(ONLINE_SESSION_KEY);

    const read = readOnlineSession(storage);
    expect(read).not.toBeNull();
    read!.roomId = "HACKED-ROOM";
    read!.displayName = "Mallory";

    expect(storage.getItem(ONLINE_SESSION_KEY)).toBe(before);
    expect(readOnlineSession(storage)).toEqual(guestSession);
  });
});

describe("onlineSession clear", () => {
  it("forgets the stored session", () => {
    const storage = memoryStorage();
    writeOnlineSession(guestSession, storage);

    clearOnlineSession(storage);

    expect(storage.getItem(ONLINE_SESSION_KEY)).toBeNull();
    expect(readOnlineSession(storage)).toBeNull();
  });

  it("is a no-op when nothing is stored", () => {
    const storage = memoryStorage();
    expect(() => clearOnlineSession(storage)).not.toThrow();
  });
});
