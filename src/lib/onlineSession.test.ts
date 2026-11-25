"@vitest-environment jsdom";

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  AVAILABLE_COLORS,
  AVAILABLE_SHAPES,
  Color,
  SymbolShape,
  type TurnAction,
} from "@/game/constants";
import {
  clearOnlineSession,
  ONLINE_SESSION_STORAGE_KEY,
  readOnlineSession,
  writeOnlineSession,
  type OnlineSessionDraft,
} from "./onlineSession";

const dom = Reflect.get(globalThis, "jsdom") as
  | { window: { sessionStorage: Storage } }
  | undefined;

if (typeof window !== "undefined" && dom) {
  Object.defineProperty(window, "sessionStorage", {
    configurable: true,
    value: dom.window.sessionStorage,
  });
}

const draft: OnlineSessionDraft = {
  roomId: "room-abc123",
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
      map.set(key, value);
    },
  };
}

function seedRaw(storage: Storage, value: string) {
  storage.setItem(ONLINE_SESSION_STORAGE_KEY, value);
}

beforeEach(() => {
  window.sessionStorage.clear();
});

afterEach(() => {
  window.sessionStorage.clear();
});

describe("online session storage", () => {
  it("round-trips the resumption facts through sessionStorage", () => {
    writeOnlineSession(draft);

    expect(readOnlineSession()).toEqual({
      version: 1,
      ...draft,
    });
    expect(window.sessionStorage.getItem(ONLINE_SESSION_STORAGE_KEY)).toContain(
      '"roomId":"room-abc123"',
    );
  });

  it("accepts an injected storage for tests", () => {
    const storage = memoryStorage();
    writeOnlineSession(draft, storage);
    expect(readOnlineSession(storage)).toEqual({ version: 1, ...draft });
  });

  it("returns null when storage is unavailable", () => {
    expect(readOnlineSession(null)).toBeNull();
    expect(() => writeOnlineSession(draft, null)).not.toThrow();
    expect(() => clearOnlineSession(null)).not.toThrow();
  });

  it("survives a storage whose methods throw", () => {
    const throwing = {
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

    expect(readOnlineSession(throwing)).toBeNull();
    expect(() => writeOnlineSession(draft, throwing)).not.toThrow();
    expect(() => clearOnlineSession(throwing)).not.toThrow();
  });

  it("returns null when nothing was ever written", () => {
    expect(readOnlineSession()).toBeNull();
    expect(readOnlineSession(memoryStorage())).toBeNull();
  });

  it("forgets the session on clear", () => {
    writeOnlineSession(draft);
    clearOnlineSession();
    expect(readOnlineSession()).toBeNull();
    expect(window.sessionStorage.getItem(ONLINE_SESSION_STORAGE_KEY)).toBeNull();
  });

  it("clear on an empty store is a no-op", () => {
    expect(() => clearOnlineSession()).not.toThrow();
    expect(() => clearOnlineSession(memoryStorage())).not.toThrow();
  });
});

describe("online session validation", () => {
  const cases: Array<[string, (storage: Storage) => void]> = [
    ["unparseable JSON", (s) => seedRaw(s, "{not json")],
    ["a JSON null", (s) => seedRaw(s, "null")],
    ["a JSON primitive", (s) => seedRaw(s, '"room-abc123"')],
    ["a JSON array", (s) => seedRaw(s, "[]")],
    [
      "a wrong version",
      (s) => seedRaw(s, JSON.stringify({ ...draft, version: 2 })),
    ],
    [
      "a missing version",
      (s) => {
        const { version: _version, ...rest } = { version: 1, ...draft };
        seedRaw(s, JSON.stringify(rest));
      },
    ],
    [
      "a malformed room id",
      (s) => seedRaw(s, JSON.stringify({ version: 1, ...draft, roomId: "bad code!" })),
    ],
    [
      "a missing room id",
      (s) => {
        const { roomId: _roomId, ...rest } = { ...draft };
        seedRaw(s, JSON.stringify({ version: 1, ...rest }));
      },
    ],
    [
      "an unknown role",
      (s) => seedRaw(s, JSON.stringify({ version: 1, ...draft, role: "admin" })),
    ],
    [
      "a missing role",
      (s) => {
        const { role: _role, ...rest } = { ...draft };
        seedRaw(s, JSON.stringify({ version: 1, ...rest }));
      },
    ],
    [
      "an unknown online action",
      (s) =>
        seedRaw(s, JSON.stringify({ version: 1, ...draft, onlineAction: "spectate" })),
    ],
    [
      "an unknown color",
      (s) => seedRaw(s, JSON.stringify({ version: 1, ...draft, color: "ultraviolet" })),
    ],
    [
      "an unknown shape",
      (s) => seedRaw(s, JSON.stringify({ version: 1, ...draft, playerShape: "blob" })),
    ],
    [
      "a missing display name",
      (s) => {
        const { displayName: _displayName, ...rest } = { ...draft };
        seedRaw(s, JSON.stringify({ version: 1, ...rest }));
      },
    ],
    [
      "an unusable display name",
      (s) =>
        seedRaw(s, JSON.stringify({ version: 1, ...draft, displayName: "<x>" })),
    ],
  ];

  it.each(cases)("rejects %s", (_label, seed) => {
    const storage = memoryStorage();
    seed(storage);
    expect(readOnlineSession(storage)).toBeNull();
  });

  it("maps a shape an older build saved onto the one that replaced it", () => {
    const storage = memoryStorage();
    seedRaw(
      storage,
      JSON.stringify({ version: 1, ...draft, playerShape: "hexagon" }),
    );
    expect(readOnlineSession(storage)?.playerShape).toBe(SymbolShape.CRESCENT);
  });

  it("accepts every current color, action and shape", () => {
    for (const color of AVAILABLE_COLORS) {
      for (const playerShape of AVAILABLE_SHAPES) {
        for (const onlineAction of ["quick", "create", "join"] as TurnAction[]) {
          for (const role of ["host", "guest"] as const) {
            const storage = memoryStorage();
            writeOnlineSession({ ...draft, color, playerShape, onlineAction, role }, storage);
            const read = readOnlineSession(storage);
            expect(read).toMatchObject({ color, playerShape, onlineAction, role });
          }
        }
      }
    }
  });
});
