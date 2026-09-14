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
  const [humanSymbol, setHumanSymbol] = useState<PlayerSymbol>(randomPlayerSymbol);
  const [gameState, setGameState] = useState<GameState>(() =>
    buildInitialState(input, humanSymbol),
  );
  const [paused, setPausedState] = useState(false);
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
        // Updater must stay pure (StrictMode double-invokes it): timer
        // teardown is owned by the gameIsActive effect below.
        if (prev.winner !== null || prev.gameStatus !== GameStatus.ACTIVE) {
          return prev;
        }
        // Use the absolute deadline so the timer stays correct even when
        // the browser throttles setInterval in background tabs. Falls back
        // to decrementing turnTimeRemaining when no deadline is set.
        const deadline =
          prev.turnDeadlineAt ??
          Date.now() + (prev.turnTimeRemaining ?? TURN_DURATION_MS);
        const remaining = Math.max(0, deadline - Date.now());
        if (remaining <= 0) {
          const random = makeRandomMove(prev.board);
          if (random === null) return prev;
          const updated = makeMove(prev, random);
          if (updated) {
            return updated;
          }
          return prev;
        }
        // `deadline` derives from this same `prev` snapshot, so there is no
        // cross-tick staleness to guard against here: a concurrent move
        // produces a fresh `prev` on the next tick, which recomputes the
        // deadline from the new state's turnDeadlineAt.
        return { ...prev, turnTimeRemaining: remaining, turnDeadlineAt: deadline };
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
        return next;
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
    // Generate the new symbol once and update both the symbol state and
    // the game state together. Without this, humanSymbol would stay stale
    // after a reset and recordWin/recordLoss would attribute the result to
    // the wrong player.
    const newSymbol = randomPlayerSymbol();
    setHumanSymbol(newSymbol);
    setGameState(buildInitialState(input, newSymbol));
  }, [input, stopTimer]);

  const exit = useCallback(() => {
    stopTimer();
    if (aiTimeoutRef.current !== null) {
      window.clearTimeout(aiTimeoutRef.current);
      aiTimeoutRef.current = null;
    }
    setGameState(freshGameState());
  }, [stopTimer]);

  // Pause/unpause is one atomic transition: the flag and the gameState
  // deadline adjustment move together at the call site, not in an effect —
  // synchronous setState inside useEffect triggers cascading renders
  // (react-hooks/set-state-in-effect, backlog-stale 09-14).
  const pausedRef = useRef(false);
  const setPaused = useCallback((target: boolean) => {
    // Repeat calls with the same target must not re-freeze: a second
    // pause would recompute turnTimeRemaining off the already-stale
    // deadline and drain it while paused.
    if (pausedRef.current === target) return;
    pausedRef.current = target;
    setPausedState(target);
    setGameState((prev) => {
      if (prev.winner !== null || prev.gameStatus !== GameStatus.ACTIVE) return prev;
      if (target) {
        // Freeze the exact remaining time; the resume branch rebuilds
        // the deadline from it.
        if (prev.turnDeadlineAt === undefined) return prev;
        return { ...prev, turnTimeRemaining: Math.max(0, prev.turnDeadlineAt - Date.now()) };
      }
      // Rebuild the absolute deadline from the frozen remaining time so
      // time spent paused doesn't count down the turn. Without this the
      // deadline keeps aging while the interval is stopped and the first
      // tick after resume can fire an immediate forced move.
      if (prev.turnDeadlineAt === undefined) return prev;
      return { ...prev, turnDeadlineAt: Date.now() + (prev.turnTimeRemaining ?? TURN_DURATION_MS) };
    });
  }, []);

  useEffect(() => {
    if (gameIsActive && !paused) {
      startTimer();
    } else {
      stopTimer();
    }
  }, [gameIsActive, paused, startTimer, stopTimer]);

  useEffect(() => {
    if (
      !paused &&
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
          return next;
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
    paused,
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

  return { gameState, humanSymbol, handleCellClick, handleReset, exit, setPaused };
}
