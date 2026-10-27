import { describe, expect, it } from "vitest";
import { pickerTileClass } from "./pickerClasses";

// The recipe was written out at nine call sites and had drifted into four
// selected variants and three unselected ones. These cases pin the two things
// that matter: each weight keeps its own emphasis, and no tile can render a
// half-state (selected styling without a ring, or an unselected tile that still
// looks chosen).

describe("pickerTileClass", () => {
  it("defaults to the compact weight", () => {
    expect(pickerTileClass(true)).toBe(pickerTileClass(true, "compact"));
  });

  it("marks a selected compact tile with the player colour and a 1px ring", () => {
    const cls = pickerTileClass(true);
    expect(cls).toContain("border-[rgb(var(--player-color))]");
    expect(cls).toContain("shadow-sm");
    expect(cls).toContain("ring-1 ring-[rgb(var(--player-color)/0.2)]");
  });

  it("gives the strong weight more emphasis, not different tokens", () => {
    const cls = pickerTileClass(true, "strong");
    expect(cls).toContain("border-[rgb(var(--player-color))]");
    expect(cls).toContain("shadow-md");
    expect(cls).toContain("ring-2 ring-[rgb(var(--player-color)/0.35)]");
    // It must not inherit the compact ring.
    expect(cls).not.toContain("ring-1");
  });

  it("always gives an unselected tile the same hover treatment", () => {
    const cls = pickerTileClass(false);
    expect(cls).toBe(pickerTileClass(false, "strong"));
    expect(cls).toContain("text-muted-foreground");
    expect(cls).toContain("hover:border-[rgb(var(--player-color)/0.4)]");
    expect(cls).toContain("hover:text-foreground");
  });

  it("never renders selected styling on an unselected tile", () => {
    for (const weight of ["compact", "strong"] as const) {
      const cls = pickerTileClass(false, weight);
      expect(cls).not.toContain("shadow-");
      expect(cls).not.toContain("ring-");
    }
  });
});
