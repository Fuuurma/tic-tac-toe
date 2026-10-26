import { useMemo } from "react";
import { GameStatus, PlayerSymbol, PlayerTypes } from "@/game/constants";
import type { GameState } from "@/game/logic";
import { t } from "@/i18n/language";
import { Board } from "./board";

interface LocalBoardProps {
  gameState: GameState;
  /** A mid-game overlay (settings, help, a confirm) has frozen the clock. */
  paused: boolean;
  onCellClick: (index: number) => void;
}

/**
 * The board of a game played on this device, wired from its game state.
 *
 * Shared by the vs Computer / vs Friend surface and the play-while-you-wait
 * warm-up, so "when is a cell dead and what does it say" has one answer.
 */
export function LocalBoard({ gameState, paused, onCellClick }: LocalBoardProps) {
  const previewPlayer =
    gameState.players[gameState.currentPlayer].type === PlayerTypes.HUMAN
      ? gameState.currentPlayer
      : undefined;
  const previewColor = previewPlayer
    ? gameState.players[previewPlayer].color
    : undefined;

  // Stable across a turn-clock tick: the tick spread-copies the state, so
  // both players keep the same identity objects. Rebuilding these as fresh
  // object literals every render failed Board's memo (and BoardCell's) on
  // every comparison, re-rendering all nine cells once a second for nothing.
  const boardColors = useMemo(
    () => ({
      [PlayerSymbol.X]: gameState.players[PlayerSymbol.X].color,
      [PlayerSymbol.O]: gameState.players[PlayerSymbol.O].color,
    }),
    [gameState.players],
  );
  const boardShapes = useMemo(
    () => ({
      [PlayerSymbol.X]: gameState.players[PlayerSymbol.X].shape,
      [PlayerSymbol.O]: gameState.players[PlayerSymbol.O].shape,
    }),
    [gameState.players],
  );

  const isAITurn =
    gameState.gameStatus === GameStatus.ACTIVE &&
    gameState.players[gameState.currentPlayer].type === PlayerTypes.COMPUTER;
  const isBoardDisabled =
    paused || isAITurn || gameState.gameStatus !== GameStatus.ACTIVE;
  // Why the board is unplayable, in words. Every empty cell announces
  // "empty" alone, which reads as interactive and behaves as a dead end.
  const boardDisabledReason = paused
    ? t("app.boardPaused")
    : isAITurn
      ? t("app.boardWaitingComputer")
      : gameState.gameStatus !== GameStatus.ACTIVE
        ? t("app.boardGameOver")
        : undefined;

  return (
    <Board
      board={gameState.board}
      colors={boardColors}
      shapes={boardShapes}
      winningCombination={gameState.winningCombination}
      nextToRemove={gameState.nextToRemove}
      previewPlayer={previewPlayer}
      previewColor={previewColor}
      previewShape={previewPlayer ? gameState.players[previewPlayer].shape : undefined}
      disabled={isBoardDisabled}
      disabledReason={boardDisabledReason}
      showVanish
      onCellClick={onCellClick}
    />
  );
}
