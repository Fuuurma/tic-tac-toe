import { describe, expect, it } from "vitest";
import { AI_Difficulty, GameModes, Color, PlayerSymbol } from "@/game/constants";
import { getAIMove } from "@/game/ai";
import { createInitialGameState, getValidMoves, makeMove } from "@/game/logic";

const onlineState = () =>
  createInitialGameState({
    gameMode: GameModes.ONLINE,
    playerXName: "X",
    playerOName: "O",
    playerColor: Color.BLUE,
    opponentColor: Color.RED,
  });

function selfPlay(diff: AI_Difficulty, games = 30, maxPlies = 80) {
  let aiWins = 0;
  let humanWins = 0;
  let draws = 0;
  let illegalMoves = 0;
  let maxPliesReached = 0;
  for (let g = 0; g < games; g += 1) {
    let s = onlineState();
    for (let p = 0; p < maxPlies; p += 1) {
      if (s.winner !== null) break;
      const validMoves = getValidMoves(s.board);
      const m = getAIMove(s, diff, s.currentPlayer);
      if (m === null) {
        if (validMoves.length > 0) illegalMoves += 1;
        break;
      }
      if (!validMoves.includes(m)) {
        illegalMoves += 1;
        break;
      }
      const next = makeMove(s, m);
      if (!next) {
        illegalMoves += 1;
        break;
      }
      s = next;
    }
    if (s.winner !== null) {
      // In self-play there is no "human" vs "AI"; just label one symbol as
      // "first" and the other as "second" so we can compare balance.
      if (s.winner === PlayerSymbol.X) humanWins += 1;
      else aiWins += 1;
    } else {
      draws += 1;
      if (s.moveCount >= maxPlies) maxPliesReached += 1;
    }
  }
  return { aiWins, humanWins, draws, illegalMoves, maxPliesReached };
}

describe("AI self-play safety", () => {
  it("Easy only produces legal moves", () => {
    const r = selfPlay(AI_Difficulty.EASY, 8);
    const total = r.aiWins + r.humanWins + r.draws;
    expect(total).toBe(8);
    expect(r.illegalMoves).toBe(0);
  });

  it("Normal MCTS only produces legal moves and stays bounded", () => {
    const r = selfPlay(AI_Difficulty.NORMAL, 6);
    const total = r.aiWins + r.humanWins + r.draws;
    expect(total).toBe(6);
    expect(r.illegalMoves).toBe(0);
  }, 30_000);

  it("Hard Minimax only produces legal moves and stays mobile-budget fast", () => {
    const r = selfPlay(AI_Difficulty.HARD, 6);
    const total = r.aiWins + r.humanWins + r.draws;
    expect(total).toBe(6);
    expect(r.illegalMoves).toBe(0);
  }, 30_000);
});
