import { WinningLine } from "@/app/types/types";
import { PlayerSymbol } from "../../constants/constants";

// This is not right...
export function getLineState(
  board: (PlayerSymbol | null)[],
  line: WinningLine
): (PlayerSymbol | null)[] {
  return line.map((pos) => board[pos]);
}
