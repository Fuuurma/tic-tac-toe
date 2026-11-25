import { afterEach, describe, expect, it } from "vitest";
import { setLocale } from "@/i18n/language";
import { Color, PlayerSymbol, SymbolShape } from "./constants";
import { createTutorialGame } from "./tutorial";

const profile = { displayName: "Maria", color: Color.GREEN, shape: SymbolShape.STAR };
const OPPONENT = PlayerSymbol.O;

describe("the practice opponent's name", () => {
  afterEach(() => {
    setLocale("en");
  });

  it("is the name it is given", () => {
    const game = createTutorialGame(profile, "IA");
    expect(game.players[OPPONENT].username).toBe("IA");
  });

  it("defaults to the English name", () => {
    setLocale("en");
    const game = createTutorialGame(profile);
    expect(game.players[OPPONENT].username).toBe("AI");
  });

  it("defaults to the Spanish name", () => {
    setLocale("es");
    const game = createTutorialGame(profile);
    expect(game.players[OPPONENT].username).toBe("IA");
  });
});
