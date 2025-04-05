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
import { checkWinner } from "../logic/checkWinner";

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

    // Clone the moves array from the *original* state
    const previousMoves = [...(this.state.moves[PlayerSymbol.O] || [])];

    // Remove oldest if needed
    if (previousMoves.length >= GAME_RULES.MAX_MOVES_PER_PLAYER) {
      const oldest = previousMoves.shift();
      if (oldest !== undefined) {
        newState.board[oldest] = null;
      }
    }

    // Add the new move
    newState.board[position] = PlayerSymbol.O;
    previousMoves.push(position);

    // Assign updated moves safely
    newState.moves[PlayerSymbol.O] = previousMoves;

    // Handle nextToRemove
    newState.nextToRemove[PlayerSymbol.O] =
      previousMoves.length >= GAME_RULES.MAX_MOVES_PER_PLAYER
        ? previousMoves[0]
        : null;

    // Winner check
    const winResult = checkWinner(newState.board);
    newState.winner = winResult === "draw" ? "draw" : winResult ?? null;

    // Switch turn if game still active
    if (!newState.winner) {
      newState.currentPlayer = PlayerSymbol.X;
    }

    return newState;
  }

  private getNextToRemove(moves: number[]): number | null {
    return moves.length >= GAME_RULES.MAX_MOVES_PER_PLAYER ? moves[0] : null;
  }
}

export const computerMove = (gameState: GameState): GameState => {
  return new AI_MoveEngine(gameState).getOptimalMove();
};
