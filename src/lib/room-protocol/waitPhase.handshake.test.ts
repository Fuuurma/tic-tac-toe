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
  status: "connected",
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

  it("releases the handoff once the authoritative state lands", () => {
    expect(
      waitPhase(quick({ status: "connected", gameStatus: GameStatus.ACTIVE })),
    ).toBeNull();
    expect(
      waitPhase(
        quick({ status: "connected", gameStatus: GameStatus.COMPLETED }),
      ),
    ).toBeNull();
  });

  it("still ends the wait on a real disconnect", () => {
    expect(waitPhase(quick({ status: "disconnected" }))).toBe("ended");
  });

  it("does not leak into a code-join guest or a created room", () => {
    expect(
      waitPhase({ ...quick({ status: "connected" }), action: "join" }),
    ).toBeNull();
    expect(waitPhase(room())).toBeNull();
  });
});
