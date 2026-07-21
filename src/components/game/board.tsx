import { useState } from "react";
import { Color, PlayerSymbol } from "@/game/constants";
import { BoardCell } from "./boardCell";
import { WinLine } from "./winLine";
import { buildWinLineGeometry } from "./winLineGeometry";
import { cn } from "@/lib/utils";

interface BoardProps {
  board: (PlayerSymbol | null)[];
  colors: Record<PlayerSymbol, Color>;
  winningCombination: readonly [number, number, number] | null;
  nextToRemove: Record<PlayerSymbol, number | null>;
  previewPlayer?: PlayerSymbol;
  previewColor?: Color;
  disabled: boolean;
  onCellClick: (index: number) => void;
}

export function Board({
  board,
  colors,
  winningCombination,
  nextToRemove,
  previewPlayer,
  previewColor,
  disabled,
  onCellClick,
}: BoardProps) {
  const [hovered, setHovered] = useState<number | null>(null);
  const winGeometry = winningCombination ? buildWinLineGeometry(winningCombination) : null;

  return (
    <div
      className={cn(
        "relative w-full max-w-md mx-auto aspect-square rounded-xl border-2 bg-muted/30 p-2 sm:p-3 shadow-inner",
      )}
    >
      <div
        role="grid"
        aria-label="Tic Tac Toe game board"
        className="grid h-full w-full grid-rows-3 gap-1.5 sm:gap-2"
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
                  isNextToRemove={isNext}
                  isWinningCell={isWinning}
                  isDisabled={disabled}
                  isHovered={hovered === index}
                  previewPlayer={previewPlayer}
                  previewColor={previewColor}
                  onClick={onCellClick}
                  onHover={setHovered}
                />
              );
            })}
          </div>
        ))}
      </div>
      {winGeometry && <WinLine geometry={winGeometry} />}
    </div>
  );
}
