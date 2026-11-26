import { describe, expect, it } from "vitest";
import { Color, SymbolShape } from "@/game/constants";
import {
  ONLINE_SESSION_KEY,
  ONLINE_SESSION_VERSION,
  clearOnlineSession,
  readOnlineSession,
  readOnlineSessionResultRecorded,
  writeOnlineSession,
  type OnlineSession,
} from "./onlineSession";

class MemoryStorage implements Storage {
  private readonly map = new Map<string, string>();

  constructor(seed: Record<string, string> = {}) {
    for (const [key, value] of Object.entries(seed)) this.map.set(key, value);
  }

  get length(): number {
    return this.map.size;
  }

  clear(): void {
    this.map.clear();
  }

  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }

  key(index: number): string | null {
    return [...this.map.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.map.delete(key);
  }

  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
}

const session: OnlineSession = {
  version: ONLINE_SESSION_VERSION,
  roomId: "ROOM42",
  role: "guest",
  onlineAction: "join",
  displayName: "Ada",
  color: Color.BLUE,
  playerShape: SymbolShape.X,
  resultRecorded: false,
};

const raw = (overrides: Record<string, unknown> = {}): string =>
  JSON.stringify({ ...session, ...overrides });

describe("readOnlineSession", () => {
  it("round-trips a written session", () => {
    const storage = new MemoryStorage();
    expect(writeOnlineSession(session, storage)).toBe(true);
    expect(readOnlineSession(storage)).toEqual(session);
  });

  it("round-trips the recorded-result flag", () => {
    const storage = new MemoryStorage();
    expect(writeOnlineSession({ ...session, resultRecorded: true }, storage)).toBe(true);
    expect(readOnlineSession(storage)?.resultRecorded).toBe(true);
  });

  it("stores the version and the seven facts, and nothing else", () => {
    const storage = new MemoryStorage();
    writeOnlineSession(session, storage);
    const stored = JSON.parse(storage.getItem(ONLINE_SESSION_KEY) ?? "{}") as Record<
      string,
      unknown
    >;
    expect(Object.keys(stored).sort()).toEqual([
      "color",
      "displayName",
      "onlineAction",
      "playerShape",
      "resultRecorded",
      "role",
      "roomId",
      "version",
    ]);
    expect(stored).not.toHaveProperty("token");
    expect(stored).not.toHaveProperty("slotToken");
    expect(stored).not.toHaveProperty("reconnectToken");
  });

  it("reads null for malformed JSON", () => {
    expect(
      readOnlineSession(new MemoryStorage({ [ONLINE_SESSION_KEY]: "{not json" })),
    ).toBeNull();
  });

  it("reads null for a wrong version", () => {
    expect(
      readOnlineSession(new MemoryStorage({ [ONLINE_SESSION_KEY]: raw({ version: 99 }) })),
    ).toBeNull();
  });

  it("reads null for a missing version", () => {
    const { version: _version, ...withoutVersion } = session;
    expect(
      readOnlineSession(
        new MemoryStorage({ [ONLINE_SESSION_KEY]: JSON.stringify(withoutVersion) }),
      ),
    ).toBeNull();
  });

  it.each([
    "roomId",
    "role",
    "onlineAction",
    "displayName",
    "color",
    "playerShape",
    "resultRecorded",
  ])("reads null when %s is missing", (field) => {
    const record: Record<string, unknown> = { ...session };
    delete record[field];
    expect(
      readOnlineSession(
        new MemoryStorage({ [ONLINE_SESSION_KEY]: JSON.stringify(record) }),
      ),
    ).toBeNull();
  });

  it.each(["has space", "ab", "", "room/42"])(
    "reads null for the invalid room id %j",
    (roomId) => {
      expect(
        readOnlineSession(new MemoryStorage({ [ONLINE_SESSION_KEY]: raw({ roomId }) })),
      ).toBeNull();
    },
  );

  it("reads null for an unknown role", () => {
    expect(
      readOnlineSession(
        new MemoryStorage({ [ONLINE_SESSION_KEY]: raw({ role: "spectator" }) }),
      ),
    ).toBeNull();
  });

  it("reads null for an unknown action", () => {
    expect(
      readOnlineSession(
        new MemoryStorage({ [ONLINE_SESSION_KEY]: raw({ onlineAction: "duel" }) }),
      ),
    ).toBeNull();
  });

  it("reads null for an unknown colour", () => {
    expect(
      readOnlineSession(
        new MemoryStorage({ [ONLINE_SESSION_KEY]: raw({ color: "chartreuse" }) }),
      ),
    ).toBeNull();
  });

  it("reads null for an unknown shape", () => {
    expect(
      readOnlineSession(
        new MemoryStorage({ [ONLINE_SESSION_KEY]: raw({ playerShape: "hexagon" }) }),
      ),
    ).toBeNull();
  });

  it("reads null when the recorded-result flag is not a boolean", () => {
    expect(
      readOnlineSession(
        new MemoryStorage({ [ONLINE_SESSION_KEY]: raw({ resultRecorded: "yes" }) }),
      ),
    ).toBeNull();
  });

  it.each([
    ["padded", " Ada"],
    ["trailing space", "Ada "],
    ["collapsed space", "Ada  Lovelace"],
    ["too short", "A"],
    ["too long", "A".repeat(21)],
  ])("reads null for a non-canonical display name (%s)", (_label, displayName) => {
    expect(
      readOnlineSession(
        new MemoryStorage({ [ONLINE_SESSION_KEY]: raw({ displayName }) }),
      ),
    ).toBeNull();
  });

  it("reads null when storage throws", () => {
    const storage = {
      getItem: () => {
        throw new Error("SecurityError");
      },
    } as unknown as Storage;
    expect(readOnlineSession(storage)).toBeNull();
  });

  it("reads null with no window (the build pass)", () => {
    expect(readOnlineSession()).toBeNull();
  });
});

describe("writeOnlineSession", () => {
  it("rejects an invalid session and leaves storage untouched", () => {
    const storage = new MemoryStorage();
    const invalid = { ...session, color: "chartreuse" } as unknown as OnlineSession;
    expect(writeOnlineSession(invalid, storage)).toBe(false);
    expect(storage.getItem(ONLINE_SESSION_KEY)).toBeNull();
  });

  it("rejects a session whose version is not the current one", () => {
    const storage = new MemoryStorage();
    const stale = { ...session, version: 99 } as unknown as OnlineSession;
    expect(writeOnlineSession(stale, storage)).toBe(false);
    expect(storage.getItem(ONLINE_SESSION_KEY)).toBeNull();
  });

  it("stores only the session fields even when the caller's object carries credentials", () => {
    const storage = new MemoryStorage();
    const withCredentials = {
      ...session,
      slotToken: "slot-secret",
      reconnectToken: "reconnect-secret",
    };
    expect(writeOnlineSession(withCredentials, storage)).toBe(true);
    const stored = JSON.parse(storage.getItem(ONLINE_SESSION_KEY) ?? "{}") as Record<
      string,
      unknown
    >;
    expect(stored).not.toHaveProperty("slotToken");
    expect(stored).not.toHaveProperty("reconnectToken");
    expect(readOnlineSession(storage)).toEqual(session);
  });

  it("overwrites the previous session", () => {
    const storage = new MemoryStorage();
    writeOnlineSession(session, storage);
    const next: OnlineSession = {
      ...session,
      roomId: "ROOM99",
      onlineAction: "quick",
      role: "host",
      resultRecorded: true,
    };
    expect(writeOnlineSession(next, storage)).toBe(true);
    expect(readOnlineSession(storage)).toEqual(next);
  });

  it("never throws when storage throws", () => {
    const storage = {
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
    } as unknown as Storage;
    expect(writeOnlineSession(session, storage)).toBe(false);
  });

  it("returns false with no storage at all", () => {
    expect(writeOnlineSession(session, null)).toBe(false);
  });
});

describe("clearOnlineSession", () => {
  it("removes the record", () => {
    const storage = new MemoryStorage();
    writeOnlineSession(session, storage);
    clearOnlineSession(storage);
    expect(storage.getItem(ONLINE_SESSION_KEY)).toBeNull();
    expect(readOnlineSession(storage)).toBeNull();
  });

  it("is a no-op on an empty storage", () => {
    const storage = new MemoryStorage();
    expect(() => clearOnlineSession(storage)).not.toThrow();
  });

  it("never throws when storage throws", () => {
    const storage = {
      removeItem: () => {
        throw new Error("SecurityError");
      },
    } as unknown as Storage;
    expect(() => clearOnlineSession(storage)).not.toThrow();
  });

  it("is a no-op with no storage at all", () => {
    expect(() => clearOnlineSession(null)).not.toThrow();
  });
});

describe("readOnlineSessionResultRecorded", () => {
  it("reports the flag for the room it was recorded in", () => {
    const storage = new MemoryStorage();
    writeOnlineSession({ ...session, resultRecorded: true }, storage);
    expect(readOnlineSessionResultRecorded("ROOM42", storage)).toBe(true);
  });

  it("says nothing about another room", () => {
    const storage = new MemoryStorage();
    writeOnlineSession({ ...session, resultRecorded: true }, storage);
    expect(readOnlineSessionResultRecorded("ROOM99", storage)).toBe(false);
  });

  it("is false without a room and without a session", () => {
    const storage = new MemoryStorage();
    expect(readOnlineSessionResultRecorded("", storage)).toBe(false);
    expect(readOnlineSessionResultRecorded("ROOM42", storage)).toBe(false);
  });
});
