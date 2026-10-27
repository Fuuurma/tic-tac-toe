import { useCallback, useEffect, useState } from "react";
import {
  AI_MOVE_DELAY_MS,
  PlayerSymbol,
  type PlayerProfile,
} from "@/game/constants";
import { isGameActive, makeMove, type GameState } from "@/game/logic";
import {
  createTutorialGame,
  findWinningMove,
  lessonStage,
  tutorialAIMove,
  type LessonStage,
} from "@/game/tutorial";

type TutorialProfile = PlayerProfile;

interface TutorialGame {
  state: GameState;
  stage: LessonStage;
  /** Cell that wins right now, offered only once the player has seen a vanish. */
  hint: number | null;
  aiToMove: boolean;
  place: (cell: number) => void;
}

/**
 * The practice round's loop: the player's taps and the sparring AI's replies,
 * both committed through the real engine. All the teaching decisions live in
 * `@/game/tutorial`; this only owns time and state.
 */
export function useTutorialGame(profile: TutorialProfile): TutorialGame {
  const [state, setState] = useState(() => createTutorialGame(profile));

  const place = useCallback((cell: number) => {
    setState((prev) =>
      prev.currentPlayer === PlayerSymbol.X ? (makeMove(prev, cell) ?? prev) : prev,
    );
  }, []);

  const aiToMove = isGameActive(state) && state.currentPlayer === PlayerSymbol.O;

  useEffect(() => {
    if (!aiToMove) return;
    const id = window.setTimeout(() => {
      setState((prev) => {
        const cell = tutorialAIMove(prev);
        return cell === null ? prev : (makeMove(prev, cell) ?? prev);
      });
    }, AI_MOVE_DELAY_MS);
    return () => window.clearTimeout(id);
  }, [aiToMove, state.moveCount]);

  const stage = lessonStage(state);
  const hint =
    stage === "win" && !aiToMove ? findWinningMove(state, PlayerSymbol.X) : null;

  return { state, stage, hint, aiToMove, place };
}
