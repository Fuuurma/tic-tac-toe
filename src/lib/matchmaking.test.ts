import { describe, expect, it } from "vitest";
import {
  getMatchPollDelay,
  MATCH_POLL_INITIAL_DELAY_MS,
  MATCH_POLL_MAX_DELAY_MS,
} from "@/lib/matchmaking";

describe("getMatchPollDelay", () => {
  it("starts with a short delay and backs off to the cap", () => {
    expect(getMatchPollDelay(0)).toBe(MATCH_POLL_INITIAL_DELAY_MS);
    expect(getMatchPollDelay(1)).toBe(MATCH_POLL_INITIAL_DELAY_MS * 2);
    expect(getMatchPollDelay(2)).toBe(MATCH_POLL_MAX_DELAY_MS);
    expect(getMatchPollDelay(20)).toBe(MATCH_POLL_MAX_DELAY_MS);
  });

  it("uses the initial delay for invalid attempts", () => {
    expect(getMatchPollDelay(-1)).toBe(MATCH_POLL_INITIAL_DELAY_MS);
    expect(getMatchPollDelay(Number.NaN)).toBe(MATCH_POLL_INITIAL_DELAY_MS);
    expect(getMatchPollDelay(1.5)).toBe(MATCH_POLL_INITIAL_DELAY_MS);
  });
});
