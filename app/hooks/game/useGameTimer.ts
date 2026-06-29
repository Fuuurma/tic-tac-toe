"use client";

import { useEffect, useRef } from "react";
import { GameState, GameMode } from "@/app/types/types";
import { PlayerSymbol } from "@/app/game/constants/constants";
import { isAITurn } from "@/app/game/ai/canAI_MakeMove";
import { isGameActive } from "@/app/game/logic/isGameActive";
import { findRandomValidMove } from "@/app/game/logic/makeRandomMove";
import { CanMakeMove } from "@/app/game/logic/canMakeMove";
import { makeMove } from "@/app/game/logic/makeMove";

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
