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
  GAME_RULES,
  PlayerSymbol,
  SIDE_POSITIONS,
  WINNING_COMBINATIONS,
} from "../constants/constants";
import { isAITurn } from "./canAI_MakeMove";

export class AI_MoveEngine {
  private state: GameState;

  constructor(gameState: GameState) {
    this.state = structuredClone(gameState);
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
      const move = this.findCriticalMove(line, positions, symbol);
      if (move !== null) return this.makeMove(move);
    }
    return null;
  }

  private getLineState(line: WinningLine): (PlayerSymbol | null)[] {
    return line.map((pos) => this.state.board[pos]);
  }

  private findCriticalMove(
    line: WinningLine,
    positions: (PlayerSymbol | null)[],
    symbol: PlayerSymbol
  ): BoardPosition | null {
    const symbolCount = positions.filter((p) => p === symbol).length;
    const emptyIndex = positions.findIndex((p) => p === null);

    return symbolCount === 2 && emptyIndex !== -1 ? line[emptyIndex] : null;
  }

  private takeCenter(): GameState | null {
    return this.isPositionAvailable(CENTER_POSITION)
      ? this.makeMove(CENTER_POSITION)
      : null;
  }

  private takeRandomCorner(): GameState | null {
    return this.takeRandomFrom(CORNER_POSITIONS);
  }

  private takeRandomSide(): GameState | null {
    return this.takeRandomFrom(SIDE_POSITIONS);
  }

  private takeRandomFrom(positions: BoardPosition[]): GameState | null {
    const available = positions.filter((pos) => this.isPositionAvailable(pos));
    return available.length > 0
      ? this.makeMove(available[Math.floor(Math.random() * available.length)])
      : null;
  }

  private takeFirstAvailable(): GameState {
    const move = this.state.board.findIndex((cell) => cell === null);
    if (move === -1) return this.state;
    return this.makeMove(move as BoardPosition);
  }

  private isPositionAvailable(pos: BoardPosition): boolean {
    return this.state.board[pos] === null;
  }

  private makeMove(position: BoardPosition): GameState {
    const newState = structuredClone(this.state);

    // Update board
    newState.board[position] = PlayerSymbol.O;

    // Update move history
    const currentMoves = [...newState.moves[PlayerSymbol.O]];
    if (currentMoves.length >= GAME_RULES.MAX_MOVES_PER_PLAYER) {
      currentMoves.shift();
    }
    currentMoves.push(position);
    newState.moves[PlayerSymbol.O] = currentMoves;

    // Update game state
    newState.currentPlayer = PlayerSymbol.X;
    newState.nextToRemove[PlayerSymbol.O] = this.getNextToRemove(currentMoves);

    return newState;
  }

  private getNextToRemove(moves: number[]): number | null {
    return moves.length >= GAME_RULES.MAX_MOVES_PER_PLAYER ? moves[0] : null;
  }
}

export const computerMove = (gameState: GameState): GameState => {
  return new AI_MoveEngine(gameState).getOptimalMove();
};
