"@vitest-environment jsdom";

import { describe, expect, it } from "vitest";
import { Color, GameModes, PlayerSymbol } from "@/game/constants";
import { createInitialGameState, makeMove, type GameState } from "@/game/logic";
import {
  HOST_SNAPSHOT_STORAGE_KEY,
  clearHostSnapshot,
  loadHostSnapshot,
  saveHostSnapshot,
  type HostSnapshot,
} from "./hostSnapshot";

function fakeStorage() {
  const data = new Map<string, string>();
  const storage: Storage = {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (key: string) => data.get(key) ?? null,
    key: (index: number) => [...data.keys()][index] ?? null,
    removeItem: (key: string) => {
      data.delete(key);
    },
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
  };
  return { storage, data };
}

function throwingStorage(): Storage {
  return {
    get length() {
      return 0;
    },
    clear: () => {},
    getItem: () => {
      throw new Error("denied");
    },
    key: () => null,
    removeItem: () => {
      throw new Error("denied");
    },
    setItem: () => {
      throw new Error("denied");
    },
  };
}

const played = (state: GameState, index: number): GameState => {
  const next = makeMove(state, index);
  if (!next) throw new Error("fixture move rejected");
  return next;
};

const snapshotFixture = (): HostSnapshot => {
  const base = createInitialGameState({
    gameMode: GameModes.ONLINE,
    playerXName: "Host",
    playerOName: "Guest",
    playerColor: Color.BLUE,
    opponentColor: Color.RED,
  });
  return {
    version: 1,
    roomId: "ROOM1234",
    hostSymbol: PlayerSymbol.X,
    gameState: played(played(base, 0), 4),
  };
};

const seedRaw = (storage: Storage, value: unknown) => {
  storage.setItem(
    HOST_SNAPSHOT_STORAGE_KEY,
    typeof value === "string" ? value : JSON.stringify(value),
  );
};

describe("hostSnapshot", () => {
  it("round-trips roomId, hostSymbol and board", () => {
    const { storage } = fakeStorage();
    const snapshot = snapshotFixture();

    saveHostSnapshot(snapshot, storage);
    const loaded = loadHostSnapshot(storage);

    expect(loaded).toEqual(snapshot);
    expect(loaded?.roomId).toBe("ROOM1234");
    expect(loaded?.hostSymbol).toBe(PlayerSymbol.X);
    expect(loaded?.gameState.board).toEqual(snapshot.gameState.board);
    expect(loaded?.gameState.board).not.toEqual(Array(9).fill(null));
  });

  it("returns null when nothing was saved", () => {
    const { storage } = fakeStorage();
    expect(loadHostSnapshot(storage)).toBeNull();
  });

  it("returns null without storage", () => {
    expect(loadHostSnapshot(null)).toBeNull();
  });

  it("returns null after clear", () => {
    const { storage } = fakeStorage();
    saveHostSnapshot(snapshotFixture(), storage);
    clearHostSnapshot(storage);
    expect(loadHostSnapshot(storage)).toBeNull();
  });

  it("rejects a wrong version", () => {
    const { storage } = fakeStorage();
    seedRaw(storage, { ...snapshotFixture(), version: 2 });
    expect(loadHostSnapshot(storage)).toBeNull();
  });

  it("rejects a room id outside the room pattern", () => {
    const { storage } = fakeStorage();
    seedRaw(storage, { ...snapshotFixture(), roomId: "bad room!" });
    expect(loadHostSnapshot(storage)).toBeNull();
  });

  it("rejects a host symbol that is not X or O", () => {
    const { storage } = fakeStorage();
    seedRaw(storage, { ...snapshotFixture(), hostSymbol: "Q" });
    expect(loadHostSnapshot(storage)).toBeNull();
  });

  it("rejects malformed JSON", () => {
    const { storage } = fakeStorage();
    seedRaw(storage, "{not json");
    expect(loadHostSnapshot(storage)).toBeNull();
  });

  it("rejects a game state with no players key", () => {
    const { storage } = fakeStorage();
    const snapshot = snapshotFixture();
    seedRaw(storage, {
      ...snapshot,
      gameState: { ...snapshot.gameState, players: undefined },
    });
    expect(loadHostSnapshot(storage)).toBeNull();
  });

  it("rejects a board that is not nine cells", () => {
    const { storage } = fakeStorage();
    const snapshot = snapshotFixture();
    seedRaw(storage, {
      ...snapshot,
      gameState: {
        ...snapshot.gameState,
        board: snapshot.gameState.board.slice(0, 8),
      },
    });
    expect(loadHostSnapshot(storage)).toBeNull();
  });

  it("rejects a board cell that is not X, O or null", () => {
    const { storage } = fakeStorage();
    const snapshot = snapshotFixture();
    seedRaw(storage, {
      ...snapshot,
      gameState: {
        ...snapshot.gameState,
        board: ["Q", ...snapshot.gameState.board.slice(1)],
      },
    });
    expect(loadHostSnapshot(storage)).toBeNull();
  });

  it("rejects an unknown game status", () => {
    const { storage } = fakeStorage();
    const snapshot = snapshotFixture();
    seedRaw(storage, {
      ...snapshot,
      gameState: { ...snapshot.gameState, gameStatus: "PAUSED" },
    });
    expect(loadHostSnapshot(storage)).toBeNull();
  });

  it("save and clear are no-ops when storage is null", () => {
    expect(() => saveHostSnapshot(snapshotFixture(), null)).not.toThrow();
    expect(() => clearHostSnapshot(null)).not.toThrow();
  });

  it("save and clear swallow storage errors", () => {
    const storage = throwingStorage();
    expect(() => saveHostSnapshot(snapshotFixture(), storage)).not.toThrow();
    expect(() => clearHostSnapshot(storage)).not.toThrow();
  });

  it("load returns null when storage reads throw", () => {
    expect(loadHostSnapshot(throwingStorage())).toBeNull();
  });

  it("uses window.sessionStorage by default, never localStorage", () => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    const snapshot = snapshotFixture();

    saveHostSnapshot(snapshot);

    expect(
      window.sessionStorage.getItem(HOST_SNAPSHOT_STORAGE_KEY),
    ).not.toBeNull();
    expect(window.localStorage.getItem(HOST_SNAPSHOT_STORAGE_KEY)).toBeNull();
    expect(loadHostSnapshot()).toEqual(snapshot);

    clearHostSnapshot();
    expect(loadHostSnapshot()).toBeNull();
    expect(window.sessionStorage.getItem(HOST_SNAPSHOT_STORAGE_KEY)).toBeNull();
  });

  it("ignores a snapshot that only exists in localStorage", () => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.localStorage.setItem(
      HOST_SNAPSHOT_STORAGE_KEY,
      JSON.stringify(snapshotFixture()),
    );

    expect(loadHostSnapshot()).toBeNull();
  });
});
