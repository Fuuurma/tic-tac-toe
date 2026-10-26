import { useEffect, useRef } from "react";
import { GameModes, GameStatus, type PlayerSymbol } from "@/game/constants";
import type { GameState } from "@/game/logic";
import type { useGameStats } from "./useGameStats";

type Recorder = Pick<ReturnType<typeof useGameStats>, "recordWin" | "recordLoss">;

/**
 * Files a finished game played on this device into the record exactly once.
 *
 * The dedupe key is the finished game's `moveCount`, and a fresh ACTIVE game
 * at move 0 re-arms it, so a rematch of the same length still counts while
 * the clock's per-tick copies of a finished state do not. Used by the local
 * surface and by the play-while-you-wait warm-up.
 *
 * The difficulty is read off the committed game state, not the live setting:
 * the running game keeps the tier it was created at (F578), so recording from
 * a mid-game selection would file the result where it was never played.
 */
export function useRecordLocalResult(
  gameState: GameState,
  humanSymbol: PlayerSymbol,
  { recordWin, recordLoss }: Recorder,
) {
  const recordedGameId = useRef(-1);
  const { gameMode, gameStatus, moveCount, winner, aiDifficulty } = gameState;

  useEffect(() => {
    if (gameStatus === GameStatus.ACTIVE && moveCount === 0) {
      recordedGameId.current = -1;
    }
    if (winner === null) return;
    if (moveCount === recordedGameId.current) return;
    recordedGameId.current = moveCount;
    // Only vs Computer splits by difficulty; a friend game has none.
    const context = {
      gameMode,
      aiDifficulty: gameMode === GameModes.VS_COMPUTER ? aiDifficulty : undefined,
    };
    if (winner === humanSymbol) recordWin(context);
    else recordLoss(context);
  }, [gameMode, gameStatus, moveCount, winner, aiDifficulty, humanSymbol, recordWin, recordLoss]);
}
