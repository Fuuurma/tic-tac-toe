import { describe, expect, it } from "vitest";
import { GameStatus } from "@/game/constants";
import type { PeerRoomState } from "@/hooks/usePeerRoom";
import { waitPhase } from "./waitPhase";

type Input = Parameters<typeof waitPhase>[0];

const quick = (over: Partial<Input> = {}): Input => ({
  action: "quick",
  role: "host",
  status: "connected",
  queue: "matched",
  gameStatus: GameStatus.WAITING,
  ...over,
});

const room = (over: Partial<Input> = {}): Input => ({
  action: "create",
  role: "host",
  status: "connected",
  queue: "none",
  gameStatus: GameStatus.WAITING,
  ...over,
});

describe("waitPhase: connected transport before the first snapshot", () => {
  it("keeps the Quick Match handoff while the game state is still WAITING", () => {
    expect(waitPhase(quick())).toBe("matched");
    expect(waitPhase(quick({ status: "connecting" }))).toBe("matched");
  });

  it("ends the Quick Match handoff once the game state leaves WAITING", () => {
    expect(
      waitPhase(quick({ gameStatus: GameStatus.ACTIVE })),
    ).toBeNull();
    expect(
      waitPhase(quick({ gameStatus: GameStatus.COMPLETED })),
    ).toBeNull();
  });

  it("keeps a created room's handoff while the guest's join is in flight", () => {
    expect(waitPhase(room())).toBe("matched");
    expect(waitPhase(room({ status: "connecting" }))).toBe("matched");
  });

  it("ends a created room's wait once play began", () => {
    expect(waitPhase(room({ gameStatus: GameStatus.ACTIVE }))).toBeNull();
  });

  it("still reports ended on a terminal status even while WAITING", () => {
    expect(waitPhase(quick({ status: "disconnected" }))).toBe("ended");
    expect(waitPhase(quick({ status: "error", queue: "none" }))).toBe("ended");
    expect(waitPhase(room({ status: "disconnected" }))).toBe("ended");
  });

  it("never waits for a guest, connected or not", () => {
    const join = (status: PeerRoomState["status"]): Input => ({
      action: "join",
      role: "guest",
      status,
      queue: "none",
      gameStatus: GameStatus.WAITING,
    });
    expect(waitPhase(join("connected"))).toBeNull();
    expect(waitPhase(join("connecting"))).toBeNull();
  });
});
