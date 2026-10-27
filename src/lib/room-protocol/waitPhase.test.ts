import { describe, expect, it } from "vitest";
import { GameStatus } from "@/game/constants";
import type { PeerRoomState } from "@/hooks/usePeerRoom";
import { waitPhase } from "./waitPhase";

type Input = Parameters<typeof waitPhase>[0];

const quick = (over: Partial<Input> = {}): Input => ({
  action: "quick",
  role: "host",
  status: "creating",
  queue: "searching",
  gameStatus: GameStatus.WAITING,
  ...over,
});

const room = (over: Partial<Input> = {}): Input => ({
  action: "create",
  role: "host",
  status: "waiting",
  queue: "none",
  gameStatus: GameStatus.WAITING,
  ...over,
});

describe("waitPhase: Quick Match", () => {
  it("is in line while the queue says searching, whatever the status", () => {
    expect(waitPhase(quick())).toBe("searching");
  });

  it("is paired once the queue says matched", () => {
    expect(waitPhase(quick({ queue: "matched" }))).toBe("matched");
  });

  it("is over when the search errors", () => {
    expect(waitPhase(quick({ status: "error", queue: "none" }))).toBe("ended");
  });

  it("is nothing once the online game exists", () => {
    for (const status of ["connected", "reconnecting", "disconnected"] as const) {
      expect(waitPhase(quick({ status, queue: "matched" }))).toBeNull();
    }
  });

  it("is nothing before a search starts or after one is left", () => {
    expect(waitPhase(quick({ status: "idle", queue: "none" }))).toBeNull();
    expect(waitPhase(quick({ status: "creating", queue: "none" }))).toBeNull();
  });
});

describe("waitPhase: a room the player created", () => {
  it("is open while the room waits for someone to arrive", () => {
    expect(waitPhase(room())).toBe("searching");
  });

  it("is paired the moment an opponent's socket is seated", () => {
    expect(waitPhase(room({ status: "connecting" }))).toBe("matched");
  });

  it("stays open through a dropped connection, since the room code still works", () => {
    expect(waitPhase(room({ status: "reconnecting" }))).toBe("searching");
  });

  it("is over when the room fails or is closed under the host", () => {
    expect(waitPhase(room({ status: "error" }))).toBe("ended");
    expect(waitPhase(room({ status: "disconnected" }))).toBe("ended");
  });

  it("is nothing once a game has started", () => {
    expect(waitPhase(room({ status: "connected", gameStatus: GameStatus.ACTIVE }))).toBeNull();
    expect(waitPhase(room({ status: "connected", gameStatus: GameStatus.COMPLETED }))).toBeNull();
    // A reconnect after play began is the game's business, not a wait.
    expect(waitPhase(room({ status: "reconnecting", gameStatus: GameStatus.ACTIVE }))).toBeNull();
  });

  it("is nothing while the room is still being built", () => {
    expect(waitPhase(room({ status: "creating" }))).toBeNull();
    expect(waitPhase(room({ status: "idle", role: null }))).toBeNull();
  });
});

describe("waitPhase: a room the player joined", () => {
  it("never waits: the host is either there or the join fails", () => {
    const join = (status: PeerRoomState["status"]): Input => ({
      action: "join",
      role: "guest",
      status,
      queue: "none",
      gameStatus: GameStatus.WAITING,
    });
    for (const status of ["connecting", "error", "disconnected", "connected"] as const) {
      expect(waitPhase(join(status))).toBeNull();
    }
  });
});
