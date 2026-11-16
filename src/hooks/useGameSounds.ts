import { useEffect, useRef } from "react";
import { PlayerTypes, type PlayerSymbol } from "@/game/constants";
import { isGameActive, type GameState } from "@/game/logic";
import { armSoundUnlock, playSound } from "@/lib/sound";

/**
 * Game-state diff → sound cues. The hook stores only the fields a cue can
 * key on, so the once-a-second turn-clock tick (a fresh state object with
 * identical play fields) costs a comparison, not a sound.
 *
 * The cues:
 * - `place` when moveCount advances — one tok per committed move, whoever
 *   made it; the win arpeggio replaces it on the move that ends the game.
 * - `vanish` when a mark retired inside that move (a cell went occupied →
 *   empty), a beat behind the place so the two do not smear.
 * - `turn` when the turn lands on a human player — in vs Computer that is
 *   "the AI answered, your move"; in two-human modes it ticks on every
 *   hand-off. Computer turns stay silent: their place cue already spoke.
 * - `win` when winner goes null → set.
 *
 * A reset (moveCount drops to 0) plays no move cues; if the fresh game's
 * first turn happens to be a human's, the turn tick doubles as the
 * "new game" cue.
 */
export function useGameSounds(gameState: GameState): void {
  const prevRef = useRef<{
    moveCount: number;
    winner: PlayerSymbol | null;
    currentPlayer: PlayerSymbol;
    board: GameState["board"];
  } | null>(null);

  // Gesture gate: the first tap or keypress anywhere unlocks the shared
  // AudioContext so cues can actually sound.
  useEffect(() => {
    armSoundUnlock();
  }, []);

  useEffect(() => {
    const prev = prevRef.current;
    prevRef.current = {
      moveCount: gameState.moveCount,
      winner: gameState.winner,
      currentPlayer: gameState.currentPlayer,
      board: gameState.board,
    };
    if (!prev) return;

    const moveCommitted = gameState.moveCount > prev.moveCount;
    const wonNow = gameState.winner !== null && prev.winner === null;
    const turnPassed =
      gameState.currentPlayer !== prev.currentPlayer &&
      isGameActive(gameState) &&
      gameState.players[gameState.currentPlayer].type === PlayerTypes.HUMAN;

    if (wonNow) {
      playSound("win");
      return;
    }

    if (moveCommitted) {
      playSound("place");
      if (gameState.board.some((cell, i) => prev.board[i] !== null && cell === null)) {
        playSound("vanish", 0.09);
      }
    }
    if (turnPassed) {
      playSound("turn", moveCommitted ? 0.16 : 0);
    }
  }, [gameState]);
}
