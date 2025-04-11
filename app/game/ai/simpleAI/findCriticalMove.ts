import { BoardPosition, WinningLine } from "@/app/types/types";
import { PlayerSymbol } from "../../constants/constants";

export function findCriticalMoveInLine(
  line: WinningLine,
  positions: (PlayerSymbol | null)[],
  symbol: PlayerSymbol
): BoardPosition | null {
  const symbolCount = positions.filter((p) => p === symbol).length;
  const emptyIndex = positions.findIndex((p) => p === null);
  return symbolCount === 2 && emptyIndex !== -1 ? line[emptyIndex] : null;
}
