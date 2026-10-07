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
} from "@/game/logic";
import { getAIMove } from "@/game/ai";
import {
  commitLocalMove,
  startLocalTurnTimer,
  stopLocalTurnTimer,
} from "./localTurnTimer";

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
  const [message, setMessage] = useState("");
  const [paused, setPausedState] = useState(false);
  const pausedRef = useRef(false);
  const tickRef = useRef<number | null>(null);
  const aiTimeoutRef = useRef<number | null>(null);
  // Latest committed snapshot, read by the interval tick, cell clicks,
  // and the AI timeout: every move computes outside the state updater
  // (purity — StrictMode double-invokes updaters) off this ref, then
  // commits through commitLocalMove's `cur === prev` guard so a stale
  // decision can't clobber a newer commit. Synced in the post-render
  // effect near the bottom of the hook.
  const gameStateRef = useRef(gameState);
  const gameIsActive = isGameActive(gameState);
  const currentPlayerType = gameState.players[gameState.currentPlayer].type;

  const stopTimer = useCallback(() => {
    stopLocalTurnTimer({ tickRef });
  }, []);

  const startTimer = useCallback(() => {
    startLocalTurnTimer({
      stateRef: gameStateRef,
      tickRef,
      setGameState,
      setMessage,
    });
  }, []);

  const handleCellClick = useCallback(
    (index: number) => {
      // Paused = game frozen (mid-game overlays); the board's disabled
      // prop is the UI gate, this is the hook-side seam (F225).
      if (pausedRef.current) return;
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
    setMessage("");
    // Generate the new symbol once and update both the symbol state and
    // the game state together. Without this, humanSymbol would stay stale
    // after a reset and recordWin/recordLoss would attribute the result to
    // the wrong player.
    const newSymbol = randomPlayerSymbol();
    setHumanSymbol(newSymbol);
    setGameState(buildInitialState(input, newSymbol));
    // The fresh game is ACTIVE again, so gameIsActive stays true and the
    // active-game effect never re-runs to restart the interval stopped
    // above — without this the reset game's turns never expire.
    if (!pausedRef.current) startTimer();
  }, [input, stopTimer, startTimer]);

  const exit = useCallback(() => {
    stopTimer();
    if (aiTimeoutRef.current !== null) {
      window.clearTimeout(aiTimeoutRef.current);
      aiTimeoutRef.current = null;
    }
    setMessage("");
    setGameState(freshGameState());
  }, [stopTimer]);

  // Pause/unpause is one atomic transition: the flag and the gameState
  // deadline adjustment move together at the call site, not in an effect —
  // synchronous setState inside useEffect triggers cascading renders
  // (react-hooks/set-state-in-effect, backlog-stale 09-14).
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

  // Keep the interval tick's snapshot current. Post-render effect (not
  // assignment during render) so StrictMode render discards can't
  // poison the ref with uncommitted state.
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  useEffect(() => {
    if (
      !paused &&
      gameState.gameStatus === GameStatus.ACTIVE &&
      currentPlayerType === PlayerTypes.COMPUTER
    ) {
      if (aiTimeoutRef.current !== null) {
        window.clearTimeout(aiTimeoutRef.current);
      }
      const scheduledSymbol = gameState.currentPlayer;
      aiTimeoutRef.current = window.setTimeout(() => {
        const prev = gameStateRef.current;
        if (prev.winner !== null || prev.gameStatus !== GameStatus.ACTIVE) return;
        // The turn may have flipped (e.g. timer forced move) after this
        // timeout was scheduled: only move when it is still the
        // scheduled AI side to play, otherwise the AI would commit a
        // move for the wrong side.
        if (prev.currentPlayer !== scheduledSymbol) return;
        if (prev.players[prev.currentPlayer].type !== PlayerTypes.COMPUTER) return;
        const move = getAIMove(prev, input.aiDifficulty ?? AI_Difficulty.NORMAL, scheduledSymbol);
        if (move === null) return;
        const next = makeMove(prev, move);
        if (!next) return;
        commitLocalMove({ setGameState, setMessage }, prev, next, (cur) => {
          // The turn clock ticks on the same 1s cadence the AI's move is
          // scheduled against, so `cur` is often the same game one tick
          // newer: same side, same turn, only the clock moved on. Re-derive
          // the move there; anything else (a completed game, a moved turn,
          // a human on the clock) belongs to another commit.
          if (!isGameActive(cur)) return cur;
          if (cur.currentPlayer !== scheduledSymbol) return cur;
          if (cur.players[cur.currentPlayer].type !== PlayerTypes.COMPUTER) return cur;
          return makeMove(cur, move) ?? cur;
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

  return { gameState, humanSymbol, message, handleCellClick, handleReset, exit, setPaused, paused };
}
