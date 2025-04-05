import { GameState } from "@/app/types/types";
import {
  BoardPosition,
  PlayerSymbol,
  WINNING_COMBINATIONS,
  WinningLine,
} from "../constants/constants";
import { isAITurn } from "./canAI_MakeMove";

const CENTER_POSITION: BoardPosition = 4;
const CORNER_POSITIONS: BoardPosition[] = [0, 2, 6, 8];
const SIDE_POSITIONS: BoardPosition[] = [1, 3, 5, 7];

export class AI_MoveEngine {
  private state: GameState;

  constructor(gameState: GameState) {
    this.state = { ...gameState };
  }

  public getOptimalMove(): GameState {
    if (!isAITurn(this.state)) return this.state;

    return (
      this.findWinningMove() ??
      this.findBlockingMove() ??
      this.takeCenter() ??
      this.takeRandomCorner() ??
      this.takeRandomSide() ??
      this.takeFirstAvailable()
    );
  }

  private findWinningMove(): GameState | null {
    return this.findStrategicMove(PlayerSymbol.O);
  }

  private findBlockingMove(): GameState | null {
    return this.findStrategicMove(PlayerSymbol.X);
  }

  private findStrategicMove(symbol: PlayerSymbol): GameState | null {
    for (const line of WINNING_COMBINATIONS) {
      const positions = this.getLineState(line);
      const move = this.findCriticalMove(positions, symbol);
      if (move !== null) return this.makeMove(move);
    }
    return null;
  }

  private getLineState(line: WinningLine): (PlayerSymbol | null)[] {
    return line.map((pos) => this.state.board[pos]);
  }

  private findCriticalMove(
    positions: (PlayerSymbol | null)[],
    symbol: PlayerSymbol
  ): BoardPosition | null {
    const symbolCount = positions.filter((p) => p === symbol).length;
    const emptyIndex = positions.findIndex((p) => p === null);

    if (symbolCount === 2 && emptyIndex !== -1) {
      return positions[emptyIndex] === null
        ? (positions[emptyIndex] as BoardPosition)
        : null;
    }
    return null;
  }

  private takeCenter(): GameState | null {
    return this.state.board[CENTER_POSITION] === null
      ? this.makeMove(CENTER_POSITION)
      : null;
  }

  private takeRandomCorner(): GameState | null {
    return this.takeRandomPosition(CORNER_POSITIONS);
  }

  private takeRandomSide(): GameState | null {
    return this.takeRandomPosition(SIDE_POSITIONS);
  }
}
