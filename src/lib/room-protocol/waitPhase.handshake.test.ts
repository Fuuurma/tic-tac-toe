import { describe, expect, it } from "vitest";
import { GameStatus } from "@/game/constants";
import { waitPhase } from "./waitPhase";

type Input = Parameters<typeof waitPhase>[0];

const quick = (over: Partial<Input> = {}): Input => ({
  action: "quick",
  role: "guest",
  status: "connecting",
  queue: "matched",
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

describe("waitPhase: connected transport before the first snapshot", () => {
  it("keeps the Quick Match handoff while the game is still WAITING", () => {
    expect(waitPhase(quick({ status: "connected" }))).toBe("matched");
  });

  it("holds for the paired host as well as the guest", () => {
    expect(waitPhase(quick({ role: "host", status: "connected" }))).toBe(
      "matched",
    );
  });

  it("treats connected like reconnecting through the whole pre-game window", () => {
    for (const status of ["connecting", "connected", "reconnecting"] as const) {
      expect(waitPhase(quick({ status }))).toBe("matched");
    }
    expect(waitPhase(quick({ status: "disconnected" }))).toBe("ended");
  });

  it("releases the handoff once the authoritative state lands", () => {
    for (const gameStatus of [GameStatus.ACTIVE, GameStatus.COMPLETED] as const) {
      for (const status of ["connected", "reconnecting", "disconnected"] as const) {
        expect(waitPhase(quick({ status, gameStatus }))).toBeNull();
      }
    }
  });

  it("does not leak into a direct join or a created room", () => {
    expect(
      waitPhase({ ...quick({ status: "connected" }), action: "join" }),
    ).toBeNull();
    expect(waitPhase(room({ status: "connected" }))).toBeNull();
  });
});
