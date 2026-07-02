"use client";

import { useEffect, useRef } from "react";
import {
  CanMakeMove,
  findRandomValidMove,
  GameMode,
  GameModes,
  GameState,
  isAITurn,
  isGameActive,
  makeMove,
  PlayerSymbol,
} from "@/src/game/core";

export const useGameTimer = (
  gameState: GameState,
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  gameMode: GameMode,
  playerSymbol: PlayerSymbol | null
) => {
  const timerMoveMadeRef = useRef<PlayerSymbol | null>(null);
  const isCurrentTurnAi = isAITurn(gameState);
  const isCurrentGameActive = isGameActive(gameState);
  const currentPlayer = gameState.currentPlayer;

  useEffect(() => {
    if (gameMode === GameModes.ONLINE) {
      timerMoveMadeRef.current = null;
      return;
    }

    // Don't run timer during AI turn
    if (isCurrentTurnAi) {
      timerMoveMadeRef.current = null;
      return;
    }

    // Reset the timer move flag when it's human's turn
    timerMoveMadeRef.current = null;

    // Only start a new timer if game is active and no winner
    if (!isCurrentGameActive) {
      return;
    }

    const intervalId = setInterval(() => {
      setGameState((prevGameState) => {
        if ((prevGameState.turnTimeRemaining || 0) <= 0) {
          clearInterval(intervalId);
          return prevGameState;
        }

        const newTime = (prevGameState.turnTimeRemaining || 0) - 100;

        if (newTime <= 0) {
          // Prevent multiple auto-moves per turn
          if (timerMoveMadeRef.current === prevGameState.currentPlayer) {
            clearInterval(intervalId);
            return { ...prevGameState, turnTimeRemaining: 0 };
          }

          timerMoveMadeRef.current = prevGameState.currentPlayer;
          const randomMoveIndex = findRandomValidMove(prevGameState);

          if (
            randomMoveIndex !== null &&
            CanMakeMove(gameMode, prevGameState.currentPlayer, playerSymbol)
          ) {
            return makeMove(prevGameState, randomMoveIndex);
          }

          clearInterval(intervalId);
          return { ...prevGameState, turnTimeRemaining: 0 };
        }

        return { ...prevGameState, turnTimeRemaining: newTime };
      });
    }, 100);

    return () => clearInterval(intervalId);
  }, [currentPlayer, gameMode, isCurrentGameActive, isCurrentTurnAi, playerSymbol, setGameState]);

  return { timerMoveMadeRef };
};
