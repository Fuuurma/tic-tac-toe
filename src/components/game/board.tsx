import { memo, useEffect, useRef, useState } from "react";
import { COLOR_RGB, Color, PlayerSymbol, SymbolShape } from "@/game/constants";
import { BoardCell } from "./boardCell";

interface BoardProps {
  board: (PlayerSymbol | null)[];
  colors: Record<PlayerSymbol, Color>;
  shapes: Record<PlayerSymbol, SymbolShape>;
  winningCombination: readonly [number, number, number] | null;
  nextToRemove: Record<PlayerSymbol, number | null>;
  previewPlayer?: PlayerSymbol;
  previewColor?: Color;
  previewShape?: SymbolShape;
  disabled: boolean;
  /** Plain-language reason the board is unplayable (paused, waiting for the
   *  other player, game over). Surfaced in every empty cell's accessible
   *  name so "empty" is not the whole story. */
  disabledReason?: string;
  onCellClick: (index: number) => void;
}

/**
 * Memoized: the turn clock rewrites `turnTimeRemaining` once a second, and
 * every other prop here is a stable reference across a tick (board,
 * winningCombination and nextToRemove are spread-copied, not rebuilt). Only
 * `hovered` changes locally, and it lives inside this component. Without
 * memo the whole 9-cell subtree re-rendered on every idle tick.
 *
 * This only pays off if callers pass stable `colors`/`shapes` objects —
 * a fresh object literal each render fails every comparison and defeats both
 * this and BoardCell's own memo.
 */
export const Board = memo(function Board({
  board,
  colors,
  shapes,
  winningCombination,
  nextToRemove,
  previewPlayer,
  previewColor,
  previewShape,
  disabled,
  disabledReason,
  onCellClick,
}: BoardProps) {
  const [hovered, setHovered] = useState<number | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.repeat ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        !/^[1-9]$/.test(event.key)
      ) {
        return;
      }

      const target = event.target;
      if (target instanceof HTMLElement) {
        const isInsideBoard = boardRef.current?.contains(target) ?? false;
        // Suppress only where digits are ENTRY — text fields and dialogs.
        // Plain buttons don't consume digit keys, so post-dialog focus
        // restoration to a panel button must keep the shortcut working
        // (the "without hijacking dialogs" smoke; needs-work 10-02 P1-2).
        const isFocusedControl = target.closest(
          'input, select, textarea, [contenteditable="true"], [role="dialog"]',
        );
        if (!isInsideBoard && isFocusedControl) return;
      }

      const index = Number(event.key) - 1;
      if (disabled || board[index] !== null) return;

      event.preventDefault();
      onCellClick(index);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [board, disabled, onCellClick]);

  return (
    <div className="flex w-full max-w-md flex-col gap-1.5">
      <div
        ref={boardRef}
        className="relative mx-auto aspect-square w-full rounded-2xl border border-white/12 bg-black/50 p-2.5 sm:p-3.5"
      >
        <div
          role="group"
          aria-label="Tic Tac Toe game board"
          aria-keyshortcuts="1 2 3 4 5 6 7 8 9"
          className="grid h-full w-full grid-rows-3 gap-1.5 sm:gap-2"
          style={
            previewColor
              ? ({ "--player-color": COLOR_RGB[previewColor] } as React.CSSProperties)
              : undefined
          }
        >
          {[0, 1, 2].map((row) => (
            <div key={row} className="grid grid-cols-3 gap-1.5 sm:gap-2">
              {[0, 1, 2].map((col) => {
                const index = row * 3 + col;
                const value = board[index];
                const isNext = value !== null && winningCombination === null && nextToRemove[value] === index;
                const isWinning = winningCombination?.includes(index) ?? false;
                return (
                  <BoardCell
                    key={index}
                    index={index}
                    value={value}
                    valueColor={value ? colors[value] : undefined}
                    valueShape={value ? shapes[value] : undefined}
                    isNextToRemove={isNext}
                    isWinningCell={isWinning}
                    isDisabled={disabled}
                    disabledReason={disabledReason}
                    isHovered={hovered === index}
                    previewPlayer={previewPlayer}
                    previewColor={previewColor}
                    previewShape={previewShape}
                    onClick={onCellClick}
                    onHover={setHovered}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});
