import { describe, it, expect } from "vitest";
import { TURN_DURATION_MS } from "./constants";
import { freezeRemaining, rebuildDeadline } from "./turnClock";

// The turn clock's two conversions had been written out six times across the
// peer timers, the local timer, the pause/resume path and two wire paths. The
// copies were identical, so nothing failed — but the guards around them had
// already drifted three ways, and a change to either expression had to be made
// six times to stay consistent.

const NOW = 1_700_000_000_000;

describe("freezeRemaining", () => {
  it("returns the time left on a live deadline", () => {
    expect(freezeRemaining(NOW + 4_000, NOW)).toBe(4_000);
  });

  it("clamps a passed deadline to zero rather than going negative", () => {
    expect(freezeRemaining(NOW - 9_000, NOW)).toBe(0);
    expect(freezeRemaining(NOW, NOW)).toBe(0);
  });

  it("falls back to the full turn when the state carries no deadline", () => {
    // The wire strips turnDeadlineAt, so this is the guest's normal shape.
    expect(freezeRemaining(undefined, NOW)).toBe(TURN_DURATION_MS);
  });
});

describe("rebuildDeadline", () => {
  it("anchors a remaining budget on the local clock", () => {
    expect(rebuildDeadline(7_000, NOW)).toBe(NOW + 7_000);
  });

  it("uses a full turn when the remaining budget is missing", () => {
    expect(rebuildDeadline(undefined, NOW)).toBe(NOW + TURN_DURATION_MS);
  });

  it("treats an explicit zero as zero, not as missing", () => {
    // 0 is a real state (a turn that expired while disconnected); `??` keeps
    // it, where `||` would have substituted a fresh turn and handed the player
    // time they had already used.
    expect(rebuildDeadline(0, NOW)).toBe(NOW);
  });
});

describe("freeze then rebuild", () => {
  it("round-trips a live clock, and a paused clock does not drain", () => {
    const deadline = NOW + 6_000;
    const frozen = freezeRemaining(deadline, NOW + 1_000);
    expect(frozen).toBe(5_000);
    // Resume 30 seconds later: the budget is what was frozen, not what the
    // wall clock ate while paused.
    expect(rebuildDeadline(frozen, NOW + 31_000)).toBe(NOW + 36_000);
  });
});
