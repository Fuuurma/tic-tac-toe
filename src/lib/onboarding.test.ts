// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from "vitest";
import {
  ONBOARDING_STORAGE_KEY,
  recordOnboardingOutcome,
  shouldShowOnboarding,
} from "./onboarding";

describe("shouldShowOnboarding", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("shows for a visitor with no stored data at all", () => {
    expect(shouldShowOnboarding()).toBe(true);
  });

  it.each([
    ["a guest id", "tic-tac-toe:guestId", "guest:abc"],
    ["a saved display name", "tic-tac-toe:displayName", "Maria"],
    ["saved preferences", "tic-tac-toe:preferences", JSON.stringify({ theme: "dark" })],
    ["a stats record", "tic-tac-toe:stats:guest:abc", "{}"],
  ])("stays out of the way of a returning player with %s", (_label, key, value) => {
    window.localStorage.setItem(key, value);
    expect(shouldShowOnboarding()).toBe(false);
  });

  it("ignores storage that belongs to other apps on the same origin", () => {
    window.localStorage.setItem("some-other-app:guestId", "x");
    expect(shouldShowOnboarding()).toBe(true);
  });

  it("never shows again once finished or skipped", () => {
    recordOnboardingOutcome("done");
    expect(window.localStorage.getItem(ONBOARDING_STORAGE_KEY)).toBe("done");
    expect(shouldShowOnboarding()).toBe(false);

    window.localStorage.clear();
    recordOnboardingOutcome("skipped");
    expect(window.localStorage.getItem(ONBOARDING_STORAGE_KEY)).toBe("skipped");
    expect(shouldShowOnboarding()).toBe(false);
  });

  it("does not show when storage is unavailable, because it could never be remembered", () => {
    expect(shouldShowOnboarding(null)).toBe(false);
  });

  it("does not throw when storage refuses reads or writes", () => {
    const hostile = {
      get length(): number {
        throw new Error("SecurityError");
      },
      key: () => {
        throw new Error("SecurityError");
      },
      getItem: () => {
        throw new Error("SecurityError");
      },
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
    } as unknown as Storage;

    expect(shouldShowOnboarding(hostile)).toBe(false);
    expect(() => recordOnboardingOutcome("done", hostile)).not.toThrow();
  });
});
