import { useState, useEffect, useCallback } from "react";
import { GameState, GameMode } from "@/app/types/types";

import {
  PlayerSymbol,
  AI_Difficulty,
  GameStatus,
  GameModes,
  Color,
} from "@/app/game/constants/constants";

interface UseGameLogicProps {
  username: string;
  gameMode: GameMode;
  aiDifficulty: AI_Difficulty;
  playerSymbol: PlayerSymbol | null;
  opponentName: string;
  selectedColor: Color;
  opponentColor: Color;
  onMessage: (msg: string) => void;
}

/**
 * Custom hook for managing game logic
 */
export function useGameLogic({
  username,
  gameMode,
  aiDifficulty,
  playerSymbol,
  opponentName,
  selectedColor,
  opponentColor,
  onMessage,
}: UseGameLogicProps) {
  const [gameState, setGameState] = useState<GameState>(createFreshGameState());
  const [loggedIn, setLoggedIn] = useState(false);

  /**
   * Initialize local game
   */
  const startLocalGame = useCallback(() => {
    if (!username.trim()) {
      onMessage("Please enter a username.");
      return false;
    }

    setGameState(
      createInitialGameState(username, gameMode, {
        opponentName,
        playerColor: selectedColor,
        opponentColor,
      })
    );
    setLoggedIn(true);
    onMessage("");
    return true;
  }, [
    username,
    gameMode,
    opponentName,
    selectedColor,
    opponentColor,
    onMessage,
  ]);

  /**
   * Handle cell click for both local and AI games
   */
  const handleCellClick = useCallback(
    (index: number) => {
      if (!loggedIn) return;

      if (!isValidMove(gameState, index, loggedIn)) return;

      if (
        CanMakeMove(
          gameMode,
          gameState.currentPlayer,
          playerSymbol || PlayerSymbol.X
        )
      ) {
        const newState = makeMove(gameState, index);
        setGameState(newState);

        // Update message for game over
        if (newState.winner) {
          onMessage(
            newState.winner === "draw"
              ? "It's a draw!"
              : `${
                  newState.players[newState.winner]?.username ||
                  `Player ${newState.winner}`
                } wins!`
          );
        }
      } else {
        onMessage("It's not your turn");
        setTimeout(() => onMessage(""), 2000);
      }
    },
    [gameState, loggedIn, gameMode, playerSymbol, onMessage]
  );

  /**
   * Reset local game
   */
  const resetGame = useCallback(() => {
    setGameState(
      createInitialGameState(username, gameMode, {
        opponentName,
        playerColor: selectedColor,
        opponentColor,
      })
    );
    onMessage("");
  }, [
    username,
    gameMode,
    opponentName,
    selectedColor,
    opponentColor,
    onMessage,
  ]);

  /**
   * Exit game and clean up state
   */
  const exitGame = useCallback(() => {
    setLoggedIn(false);
    setGameState(createFreshGameState());
    onMessage("");
  }, [onMessage]);

  /**
   * Handle AI moves when it's the AI's turn
   */
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    if (loggedIn && gameMode === GameModes.VS_COMPUTER && isAITurn(gameState)) {
      timeoutId = setTimeout(() => {
        handleAI_Move(gameState, setGameState, aiDifficulty);
      }, 500); // Small delay for better UX
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [gameState, gameMode, loggedIn, aiDifficulty]);

  return {
    gameState,
    setGameState,
    loggedIn,
    setLoggedIn,
    startLocalGame,
    handleCellClick,
    resetGame,
    exitGame,
  };
}
