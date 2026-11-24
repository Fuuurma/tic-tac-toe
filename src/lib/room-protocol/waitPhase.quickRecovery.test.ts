import { describe, expect, it } from "vitest";
import { GameStatus } from "@/game/constants";
import { waitPhase } from "./waitPhase";

type Input = Parameters<typeof waitPhase>[0];

const quick = (over: Partial<Input> = {}): Input => ({
  action: "quick",
  role: "host",
  status: "creating",
  queue: "matched",
  gameStatus: GameStatus.WAITING,
  ...over,
});

describe("waitPhase: a Quick Match that loses the connection before the first move", () => {
  it("keeps the paired handoff on screen through a reconnect", () => {
    expect(waitPhase(quick({ status: "reconnecting" }))).toBe("matched");
  });

  it("ends the wait without a game when the connection is gone", () => {
    expect(waitPhase(quick({ status: "disconnected" }))).toBe("ended");
  });

  it("hands the connection back to the in-game banners once play began", () => {
    expect(
      waitPhase(quick({ status: "reconnecting", gameStatus: GameStatus.ACTIVE })),
    ).toBeNull();
    expect(
      waitPhase(quick({ status: "disconnected", gameStatus: GameStatus.ACTIVE })),
    ).toBeNull();
    expect(
      waitPhase(quick({ status: "reconnecting", gameStatus: GameStatus.COMPLETED })),
    ).toBeNull();
  });

  it("leaves the connected and failed states where they were", () => {
    expect(waitPhase(quick({ status: "connected" }))).toBeNull();
    expect(waitPhase(quick({ status: "error", queue: "none" }))).toBe("ended");
  });
});
