"use client";

import { useEffect, useCallback } from "react";
import {
  AI_Difficulty,
  CanMakeMove,
  Color,
  createInitialGameState,
  GameMode,
  GameModes,
  GameState,
  handleAI_Move,
  isAITurn,
  isValidMove,
  makeMove,
  PlayerSymbol,
} from "@/src/game/core";
import { resolveOpponentColor } from "@/app/utils/colors/resolveOpponentColor";

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
        opponentColor: resolveOpponentColor(gameMode, selectedColor, opponentColor),
      })
    );
  }, [gameMode, setGameState, setMessage]);

  return { handleLocalMove, resetLocalGame };
};
