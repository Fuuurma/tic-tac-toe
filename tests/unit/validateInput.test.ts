import { describe, expect, it } from "vitest";
import { Color, GameModes } from "@/app/game/constants/constants";
import { ValidateUserInput } from "@/app/game/auth/validateInput";

describe("ValidateUserInput", () => {
  it("requires a player name", () => {
    expect(
      ValidateUserInput("", "", GameModes.VS_COMPUTER, Color.BLUE, Color.RED)
    ).toEqual({
      isValid: false,
      message: "Please enter your username.",
    });
  });

  it("allows online play without an opponent name or color check", () => {
    expect(
      ValidateUserInput("player", "", GameModes.ONLINE, Color.RED, Color.RED)
    ).toEqual({
      isValid: true,
      message: null,
    });
  });

  it("requires local multiplayer names and colors to differ", () => {
    expect(
      ValidateUserInput("player", "", GameModes.VS_FRIEND, Color.BLUE, Color.RED)
    ).toEqual({
      isValid: false,
      message: "Please enter opponent's username.",
    });

    expect(
      ValidateUserInput("player", "player", GameModes.VS_FRIEND, Color.BLUE, Color.RED)
    ).toEqual({
      isValid: false,
      message: "Player names must be different.",
    });

    expect(
      ValidateUserInput("player", "opponent", GameModes.VS_FRIEND, Color.BLUE, Color.BLUE)
    ).toEqual({
      isValid: false,
      message: "Players must choose different colors.",
    });
  });
});
