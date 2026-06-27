import { describe, expect, it } from "vitest";
import { Color, GameModes } from "@/app/game/constants/constants";
import { resolveOpponentColor } from "@/app/utils/colors/resolveOpponentColor";

describe("resolveOpponentColor", () => {
  it("chooses a different color for the AI when the player picks the opponent default", () => {
    const resolvedColor = resolveOpponentColor(
      GameModes.VS_COMPUTER,
      Color.RED,
      Color.RED
    );

    expect(resolvedColor).not.toBe(Color.RED);
    expect(Object.values(Color)).toContain(resolvedColor);
  });

  it("keeps the configured opponent color when there is no AI color conflict", () => {
    expect(
      resolveOpponentColor(GameModes.VS_COMPUTER, Color.BLUE, Color.RED)
    ).toBe(Color.RED);
  });

  it("does not rewrite local multiplayer colors", () => {
    expect(resolveOpponentColor(GameModes.VS_FRIEND, Color.RED, Color.RED)).toBe(
      Color.RED
    );
  });
});
