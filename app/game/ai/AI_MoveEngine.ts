import {
  BoardPosition,
  CellValue,
  GameState,
  MovesHistory,
  WinningLine,
} from "@/app/types/types";
import {
  CENTER_POSITION,
  CORNER_POSITIONS,
  PlayerSymbol,
  SIDE_POSITIONS,
  WINNING_COMBINATIONS,
} from "../constants/constants";
import { isAITurn } from "./canAI_MakeMove";

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

  private takeRandomPosition(positions: BoardPosition[]): GameState | null {
    const available = positions.filter((pos) => this.state.board[pos] === null);
    return available.length > 0
      ? this.makeMove(available[Math.floor(Math.random() * available.length)])
      : null;
  }

  private takeFirstAvailable(): GameState {
    const move = this.state.board.findIndex((cell) => cell === null);
    return this.makeMove(move as BoardPosition);
  }

  private makeMove(position: BoardPosition): GameState {
    return {
      ...this.state,
      board: this.applyMoveToBoard(position),
      moves: this.updateMoveHistory(position),
      currentPlayer: PlayerSymbol.X,
    };
  }

  private applyMoveToBoard(position: BoardPosition): CellValue[] {
    const newBoard = [...this.state.board];
    newBoard[position] = PlayerSymbol.O;
    return newBoard;
  }

  private updateMoveHistory(position: BoardPosition): MovesHistory {
    const moves = [...this.state.moves[PlayerSymbol.O]];
    if (moves.length >= 3) moves.shift();
    moves.push(position);

    return {
      ...this.state.moves,
      [PlayerSymbol.O]: moves,
    };
  }
}

export const computerMove = (gameState: GameState): GameState => {
  return new AI_MoveEngine(gameState).getOptimalMove();
};
