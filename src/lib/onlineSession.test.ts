import { describe, expect, it } from "vitest";
import { Color, SymbolShape } from "@/game/constants";
import {
  clearOnlineSession,
  readOnlineSession,
  writeOnlineSession,
  type OnlineSession,
} from "./onlineSession";

class MemStorage implements Storage {
  private map = new Map<string, string>();

  get length(): number {
    return this.map.size;
  }

  clear(): void {
    this.map.clear();
  }

  getItem(key: string): string | null {
    return this.map.has(key) ? (this.map.get(key) as string) : null;
  }

  key(index: number): string | null {
    return [...this.map.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.map.delete(key);
  }

  setItem(key: string, value: string): void {
    this.map.set(key, String(value));
  }
}

const VALID: OnlineSession = {
  roomId: "ROOM42",
  role: "guest",
  onlineAction: "join",
  displayName: "Maria",
  color: Color.BLUE,
  playerShape: SymbolShape.X,
};

const KEY = "tic-tac-toe:online-session";

const seed = (storage: Storage, value: unknown): void => {
  storage.setItem(KEY, typeof value === "string" ? value : JSON.stringify(value));
};

describe("readOnlineSession", () => {
  it("returns null when storage is unavailable", () => {
    expect(readOnlineSession(null)).toBeNull();
  });

  it("returns null when no session was written", () => {
    expect(readOnlineSession(new MemStorage())).toBeNull();
  });

  it("round-trips the resumption facts without the envelope version", () => {
    const storage = new MemStorage();
    writeOnlineSession(VALID, storage);

    const read = readOnlineSession(storage);
    expect(read).toEqual(VALID);
    expect(read).not.toHaveProperty("version");
  });

  it("stores a versioned envelope", () => {
    const storage = new MemStorage();
    writeOnlineSession(VALID, storage);

    const raw = JSON.parse(storage.getItem(KEY) as string) as Record<
      string,
      unknown
    >;
    expect(raw.version).toBe(1);
    expect(raw.roomId).toBe(VALID.roomId);
    expect(raw.role).toBe(VALID.role);
    expect(raw.onlineAction).toBe(VALID.onlineAction);
    expect(raw.displayName).toBe(VALID.displayName);
    expect(raw.color).toBe(VALID.color);
    expect(raw.playerShape).toBe(VALID.playerShape);
  });

  it("returns a fresh copy — mutating the result cannot corrupt storage", () => {
    const storage = new MemStorage();
    writeOnlineSession(VALID, storage);
    const before = storage.getItem(KEY);

    const read = readOnlineSession(storage);
    expect(read).not.toBeNull();
    (read as { roomId: string }).roomId = "HACKED";

    expect(readOnlineSession(storage)).toEqual(VALID);
    expect(storage.getItem(KEY)).toBe(before);
  });

  it("rejects malformed JSON", () => {
    const storage = new MemStorage();
    seed(storage, "{not json");
    expect(readOnlineSession(storage)).toBeNull();
  });

  it.each(["null", "42", '"text"', "true", "[1,2,3]", "undefined"])(
    "rejects non-object JSON: %s",
    (raw) => {
      const storage = new MemStorage();
      seed(storage, raw);
      expect(readOnlineSession(storage)).toBeNull();
    },
  );

  it.each([0, 2, "1", null, undefined])(
    "rejects wrong or missing version: %s",
    (version) => {
      const storage = new MemStorage();
      seed(storage, { version, ...VALID });
      expect(readOnlineSession(storage)).toBeNull();
    },
  );

  it("rejects a missing version field", () => {
    const storage = new MemStorage();
    const { version: _version, ...rest } = { version: 1, ...VALID };
    seed(storage, rest);
    expect(readOnlineSession(storage)).toBeNull();
  });

  it.each([
    "roomId",
    "role",
    "onlineAction",
    "displayName",
    "color",
    "playerShape",
  ] as const)("rejects a missing %s field", (field) => {
    const storage = new MemStorage();
    const partial: Record<string, unknown> = { version: 1, ...VALID };
    delete partial[field];
    seed(storage, partial);
    expect(readOnlineSession(storage)).toBeNull();
  });

  it.each([
    "abc",
    "ab",
    "room id",
    "room.id",
    " room42",
    "room42 ",
    "\troom42",
    "room42\n",
    "",
    "a".repeat(65),
  ])("rejects malformed room id %j — including values only valid after trim", (roomId) => {
    const storage = new MemStorage();
    seed(storage, { version: 1, ...VALID, roomId });
    expect(readOnlineSession(storage)).toBeNull();
  });

  it.each(["admin", "HOST", "Guest", "", null, 42, ["guest"]])(
    "rejects unknown role %j",
    (role) => {
      const storage = new MemStorage();
      seed(storage, { version: 1, ...VALID, role });
      expect(readOnlineSession(storage)).toBeNull();
    },
  );

  it.each(["random", "CREATE", "Join", "", null, 7])(
    "rejects unknown onlineAction %j",
    (onlineAction) => {
      const storage = new MemStorage();
      seed(storage, { version: 1, ...VALID, onlineAction });
      expect(readOnlineSession(storage)).toBeNull();
    },
  );

  it.each(["quick", "create", "join"] as const)(
    "accepts onlineAction %s",
    (onlineAction) => {
      const storage = new MemStorage();
      seed(storage, { version: 1, ...VALID, onlineAction });
      expect(readOnlineSession(storage)?.onlineAction).toBe(onlineAction);
    },
  );

  it.each(["hexagon", "octagon", "circle", "", null, 3])(
    "rejects unknown or legacy playerShape %j",
    (playerShape) => {
      const storage = new MemStorage();
      seed(storage, { version: 1, ...VALID, playerShape });
      expect(readOnlineSession(storage)).toBeNull();
    },
  );

  it.each(["bluee", "Blue", "BLUE", "", null, 7, ["blue"]])(
    "rejects unknown color %j",
    (color) => {
      const storage = new MemStorage();
      seed(storage, { version: 1, ...VALID, color });
      expect(readOnlineSession(storage)).toBeNull();
    },
  );

  it.each(["", "   ", "  Maria  ", "Maria ", " M", "M", "Maria\u200B", 42, null])(
    "rejects empty or non-canonical displayName %j",
    (displayName) => {
      const storage = new MemStorage();
      seed(storage, { version: 1, ...VALID, displayName });
      expect(readOnlineSession(storage)).toBeNull();
    },
  );

  it("accepts a canonical multi-word display name", () => {
    const storage = new MemStorage();
    seed(storage, { version: 1, ...VALID, displayName: "Crimson Fox" });
    expect(readOnlineSession(storage)?.displayName).toBe("Crimson Fox");
  });

  it("returns null instead of throwing when getItem throws", () => {
    const storage = {
      getItem: () => {
        throw new Error("SecurityError");
      },
    } as unknown as Storage;
    expect(readOnlineSession(storage)).toBeNull();
  });
});

describe("writeOnlineSession", () => {
  it("writes nothing when storage is unavailable", () => {
    expect(() => writeOnlineSession(VALID, null)).not.toThrow();
  });

  it("is a no-op for every invalid session shape", () => {
    const invalid: unknown[] = [
      null,
      "text",
      42,
      [],
      { ...VALID, roomId: " room42" },
      { ...VALID, roomId: "bad id" },
      { ...VALID, role: "admin" },
      { ...VALID, onlineAction: "random" },
      { ...VALID, playerShape: "hexagon" },
      { ...VALID, color: "bluee" },
      { ...VALID, displayName: "" },
      { ...VALID, displayName: "  padded  " },
      { ...VALID, displayName: "x" },
      { roomId: VALID.roomId },
    ];
    for (const candidate of invalid) {
      const storage = new MemStorage();
      writeOnlineSession(candidate as OnlineSession, storage);
      expect(storage.length).toBe(0);
    }
  });

  it("does not throw when setItem throws", () => {
    const storage = {
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
    } as unknown as Storage;
    expect(() => writeOnlineSession(VALID, storage)).not.toThrow();
  });

  it("overwrites an existing session", () => {
    const storage = new MemStorage();
    writeOnlineSession(VALID, storage);
    const next = { ...VALID, roomId: "OTHER-1", role: "host" as const };
    writeOnlineSession(next, storage);
    expect(readOnlineSession(storage)).toEqual(next);
  });
});

describe("clearOnlineSession", () => {
  it("removes a stored session", () => {
    const storage = new MemStorage();
    writeOnlineSession(VALID, storage);
    clearOnlineSession(storage);
    expect(storage.getItem(KEY)).toBeNull();
    expect(readOnlineSession(storage)).toBeNull();
  });

  it("is a no-op when nothing is stored", () => {
    const storage = new MemStorage();
    expect(() => clearOnlineSession(storage)).not.toThrow();
    expect(storage.length).toBe(0);
  });

  it("is a no-op when storage is unavailable", () => {
    expect(() => clearOnlineSession(null)).not.toThrow();
  });

  it("does not throw when removeItem throws", () => {
    const storage = {
      removeItem: () => {
        throw new Error("SecurityError");
      },
    } as unknown as Storage;
    expect(() => clearOnlineSession(storage)).not.toThrow();
  });
});

describe("default storage (no window in this environment)", () => {
  it("reads null, writes and clears as no-ops", () => {
    expect(readOnlineSession()).toBeNull();
    expect(() => writeOnlineSession(VALID)).not.toThrow();
    expect(() => clearOnlineSession()).not.toThrow();
  });
});
