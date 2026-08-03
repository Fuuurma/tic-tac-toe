import { useCallback, useEffect, useRef, useState } from "react";
import {
  AI_Difficulty,
  AI_MOVE_DELAY_MS,
  AI_MOVE_DELAY_JITTER_MS,
  Color,
  GameModes,
  GameStatus,
  PlayerSymbol,
  PlayerTypes,
  SymbolShape,
  TURN_DURATION_MS,
  randomPlayerSymbol,
} from "@/game/constants";
import {
  type GameState,
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
  playerName: string;
  opponentName: string;
  playerColor: Color;
  opponentColor: Color;
  playerShape?: SymbolShape;
  opponentShape?: SymbolShape;
  aiDifficulty?: AI_Difficulty;
  opponentType?: import("@/game/constants").PlayerType;
}

function buildInitialState(input: LocalGameInput, humanSymbol: PlayerSymbol): GameState {
  return createInitialGameState({
    gameMode: input.gameMode,
    playerXName: humanSymbol === PlayerSymbol.X ? input.playerName : input.opponentName,
    playerOName: humanSymbol === PlayerSymbol.O ? input.playerName : input.opponentName,
    playerColor: input.playerColor,
    opponentColor: input.opponentColor,
    playerShape: input.playerShape,
    opponentShape: input.opponentShape,
    humanSymbol,
    aiDifficulty: input.aiDifficulty,
    opponentType: input.opponentType,
  });
}

export function useLocalGame(input: LocalGameInput) {
  const [humanSymbol] = useState<PlayerSymbol>(randomPlayerSymbol);
  const [gameState, setGameState] = useState<GameState>(() =>
    buildInitialState(input, humanSymbol),
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
        if (prev.winner !== null || prev.gameStatus !== GameStatus.ACTIVE) {
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
    // Stop the timer first to prevent a stale interval tick from
    // decrementing the fresh game's turnTimeRemaining before the
    // active-game effect restarts the interval.
    stopTimer();
    if (aiTimeoutRef.current !== null) {
      window.clearTimeout(aiTimeoutRef.current);
      aiTimeoutRef.current = null;
    }
    setGameState(buildInitialState(input, randomPlayerSymbol()));
  }, [input, stopTimer]);

  const exit = useCallback(() => {
    stopTimer();
    if (aiTimeoutRef.current !== null) {
      window.clearTimeout(aiTimeoutRef.current);
      aiTimeoutRef.current = null;
    }
    setGameState(freshGameState());
  }, [stopTimer]);

  useEffect(() => {
    if (gameIsActive) {
      startTimer();
    } else {
      stopTimer();
    }
  }, [gameIsActive, startTimer, stopTimer]);

  useEffect(() => {
    if (
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
          const move = getAIMove(prev, input.aiDifficulty ?? AI_Difficulty.NORMAL, aiSymbol);
          if (move === null) return prev;
          const next = makeMove(prev, move);
          if (!next) return prev;
          return { ...next, turnTimeRemaining: TURN_DURATION_MS };
        });
      }, AI_MOVE_DELAY_MS + Math.random() * AI_MOVE_DELAY_JITTER_MS);
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

  return { gameState, humanSymbol, handleCellClick, handleReset, exit };
}
