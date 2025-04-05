import { GameState } from "@/app/types/types";
import { BoardPosition } from "../constants/constants";
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
}
