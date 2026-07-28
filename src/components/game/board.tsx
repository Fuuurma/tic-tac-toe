import { useEffect, useRef, useState } from "react";
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
  onCellClick: (index: number) => void;
}

export function Board({
  board,
  colors,
  shapes,
  winningCombination,
  nextToRemove,
  previewPlayer,
  previewColor,
  previewShape,
  disabled,
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
        const isFocusedControl = target.closest(
          'button, input, select, textarea, [contenteditable="true"], [role="dialog"]',
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
        className="relative mx-auto aspect-square w-full rounded-2xl border border-black/30 bg-black/35 p-2 shadow-inner sm:p-3"
      >
        <div
          role="grid"
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
            <div key={row} role="row" className="grid grid-cols-3 gap-1.5 sm:gap-2">
              {[0, 1, 2].map((col) => {
                const index = row * 3 + col;
                const value = board[index];
                const isNext = value !== null && nextToRemove[value] === index;
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
}
