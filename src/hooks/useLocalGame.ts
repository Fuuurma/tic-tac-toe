import { useCallback, useEffect, useRef, useState } from "react";
import {
  AI_Difficulty,
  Color,
  GameModes,
  GameStatus,
  PlayerTypes,
  TURN_DURATION_MS,
} from "@/game/constants";
import {
  GameState,
  createInitialGameState,
  freshGameState,
  isGameActive,
  isValidMove,
  makeMove,
  makeRandomMove,
} from "@/game/logic";
import { getAIMove } from "@/game/ai";

export interface LocalGameInput {
  gameMode: typeof GameModes.VS_COMPUTER | typeof GameModes.VS_FRIEND;
  playerXName: string;
  playerOName: string;
  playerColor: Color;
  opponentColor: Color;
  aiDifficulty?: AI_Difficulty;
}

export function useLocalGame(input: LocalGameInput) {
  const [gameState, setGameState] = useState<GameState>(() =>
    createInitialGameState({
      gameMode: input.gameMode,
      playerXName: input.playerXName,
      playerOName: input.playerOName,
      playerColor: input.playerColor,
      opponentColor: input.opponentColor,
      aiDifficulty: input.aiDifficulty,
    }),
  );
  const tickRef = useRef<number | null>(null);
  const aiTimeoutRef = useRef<number | null>(null);
  const gameIsActive = isGameActive(gameState);
  const currentPlayerType = gameState.players[gameState.currentPlayer].type;

  const stopTimer = useCallback(() => {
    if (tickRef.current !== null) {
      window.clearInterval(tickRef.current);
      tickRef.current = null;
    }
  }, []);

  const startTimer = useCallback(() => {
    stopTimer();
    tickRef.current = window.setInterval(() => {
      setGameState((prev) => {
        if (prev.winner !== null) {
          stopTimer();
          return prev;
        }
        const remaining = (prev.turnTimeRemaining ?? TURN_DURATION_MS) - 1000;
        if (remaining <= 0) {
          const random = makeRandomMove(prev.board);
          if (random === null) return prev;
          const updated = makeMove(prev, random);
          if (updated) {
            return { ...updated, turnTimeRemaining: TURN_DURATION_MS };
          }
          return prev;
        }
        return { ...prev, turnTimeRemaining: remaining };
      });
    }, 1000);
  }, [stopTimer]);

  const handleCellClick = useCallback(
    (index: number) => {
      setGameState((prev) => {
        if (!isValidMove(prev, index, prev.currentPlayer)) return prev;
        if (prev.players[prev.currentPlayer].type === PlayerTypes.COMPUTER) return prev;
        const next = makeMove(prev, index);
        if (!next) return prev;
        return { ...next, turnTimeRemaining: TURN_DURATION_MS };
      });
    },
    [],
  );

  const handleReset = useCallback(() => {
    setGameState(
      createInitialGameState({
        gameMode: input.gameMode,
        playerXName: input.playerXName,
        playerOName: input.playerOName,
        playerColor: input.playerColor,
        opponentColor: input.opponentColor,
        aiDifficulty: input.aiDifficulty,
      }),
    );
  }, [input]);

  const exit = useCallback(() => {
    setGameState(freshGameState());
  }, []);

  useEffect(() => {
    if (gameIsActive) {
      startTimer();
    } else {
      stopTimer();
    }
  }, [gameIsActive, startTimer, stopTimer]);

  useEffect(() => {
    if (
      input.gameMode === GameModes.VS_COMPUTER &&
      gameState.gameStatus === GameStatus.ACTIVE &&
      currentPlayerType === PlayerTypes.COMPUTER
    ) {
      if (aiTimeoutRef.current !== null) {
        window.clearTimeout(aiTimeoutRef.current);
      }
      aiTimeoutRef.current = window.setTimeout(() => {
        setGameState((prev) => {
          if (prev.winner !== null) return prev;
          const aiSymbol = prev.currentPlayer;
          const move = getAIMove(prev, input.aiDifficulty ?? AI_Difficulty.EASY, aiSymbol);
          if (move === null) return prev;
          const next = makeMove(prev, move);
          if (!next) return prev;
          return { ...next, turnTimeRemaining: TURN_DURATION_MS };
        });
      }, 600);
    }
    return () => {
      if (aiTimeoutRef.current !== null) {
        window.clearTimeout(aiTimeoutRef.current);
        aiTimeoutRef.current = null;
      }
    };
  }, [
    gameState.currentPlayer,
    gameState.gameStatus,
    gameState.winner,
    gameState.moveCount,
    currentPlayerType,
    input.gameMode,
    input.aiDifficulty,
  ]);

  useEffect(
    () => () => {
      stopTimer();
      if (aiTimeoutRef.current !== null) {
        window.clearTimeout(aiTimeoutRef.current);
      }
    },
    [stopTimer],
  );

  return { gameState, handleCellClick, handleReset, exit };
}
