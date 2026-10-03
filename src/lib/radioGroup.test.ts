import { describe, expect, it } from "vitest";
import { radioGroupKeyTarget } from "./radioGroup";

describe("radioGroupKeyTarget", () => {
  it("moves to the next radio on ArrowRight and wraps at the end", () => {
    expect(radioGroupKeyTarget(0, 3, "ArrowRight")).toBe(1);
    expect(radioGroupKeyTarget(2, 3, "ArrowRight")).toBe(0);
  });

  it("moves to the previous radio on ArrowLeft and wraps at the start", () => {
    expect(radioGroupKeyTarget(1, 3, "ArrowLeft")).toBe(0);
    expect(radioGroupKeyTarget(0, 3, "ArrowLeft")).toBe(2);
  });

  it("treats ArrowDown/ArrowUp like next/previous", () => {
    expect(radioGroupKeyTarget(0, 3, "ArrowDown")).toBe(1);
    expect(radioGroupKeyTarget(0, 3, "ArrowUp")).toBe(2);
  });

  it("jumps to first/last on Home/End", () => {
    expect(radioGroupKeyTarget(1, 4, "Home")).toBe(0);
    expect(radioGroupKeyTarget(1, 4, "End")).toBe(3);
  });

  it("returns null for unrelated keys", () => {
    expect(radioGroupKeyTarget(1, 3, "Enter")).toBeNull();
    expect(radioGroupKeyTarget(1, 3, "Tab")).toBeNull();
    expect(radioGroupKeyTarget(1, 3, " ")).toBeNull();
  });

  it("returns null when focus is not on a radio or the group is empty", () => {
    expect(radioGroupKeyTarget(-1, 3, "ArrowRight")).toBeNull();
    expect(radioGroupKeyTarget(0, 0, "ArrowRight")).toBeNull();
  });
});
