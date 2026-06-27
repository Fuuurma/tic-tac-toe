"use client";

import { useEffect, useCallback } from "react";
import { GameState, GameMode } from "@/app/types/types";
import { 
  GameModes, 
  AI_Difficulty, 
  Color, 
  PlayerSymbol
} from "@/app/game/constants/constants";
import { createInitialGameState } from "@/app/game/logic/createInitialGameState";
import { isAITurn } from "@/app/game/ai/canAI_MakeMove";
import { handleAI_Move } from "@/app/game/ai/handleAI_Move";
import { isValidMove } from "@/app/game/logic/isValidMove";
import { CanMakeMove } from "@/app/game/logic/canMakeMove";
import { makeMove } from "@/app/game/logic/makeMove";

export const useLocalGame = (
  gameState: GameState,
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  gameMode: GameMode,
  aiDifficulty: AI_Difficulty,
  loggedIn: boolean,
  playerSymbol: PlayerSymbol | null,
  setMessage: (msg: string) => void
) => {
  // ----- COMPUTER MOVES ----- //
  useEffect(() => {
    if (gameMode === GameModes.ONLINE || !isAITurn(gameState)) {
      return;
    }

    const cleanup = handleAI_Move(gameState, setGameState, aiDifficulty);
    return cleanup;
  }, [gameState, aiDifficulty, gameMode, setGameState]);

  const handleLocalMove = useCallback((index: number) => {
    if (!isValidMove(gameState, index, loggedIn)) {
      setMessage("Invalid move.");
      return;
    }

    if (CanMakeMove(gameMode, gameState.currentPlayer, playerSymbol)) {
      const newState = makeMove(gameState, index);
      setGameState(newState);
    } else {
      setMessage("It's not your turn");
      setTimeout(() => setMessage(""), 2000);
    }
  }, [gameState, gameMode, loggedIn, playerSymbol, setGameState, setMessage]);

  const resetLocalGame = useCallback((
    username: string,
    opponentName: string,
    selectedColor: Color,
    opponentColor: Color
  ) => {
    setMessage("");
    setGameState(
      createInitialGameState(username, gameMode, {
        opponentName,
        playerColor: selectedColor,
        opponentColor,
      })
    );
  }, [gameMode, setGameState, setMessage]);

  return { handleLocalMove, resetLocalGame };
};
