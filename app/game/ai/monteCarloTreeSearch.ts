import { GameState } from "@/app/types/types";
import { PlayerSymbol } from "../constants/constants";
import { getValidMoves } from "../logic/getValidMoves";

export class MonteCarloTreeSearchNode {
  state: GameState;
  parent: MonteCarloTreeSearchNode | null;
  children: Map<number, MonteCarloTreeSearchNode>;
  visits: number;
  score: number;
  untriedMoves: number[];
  playerTurn: PlayerSymbol;

  constructor(
    state: GameState,
    parent: MonteCarloTreeSearchNode | null = null
  ) {
    this.state = state;
    this.parent = parent;
    this.children = new Map();
    this.visits = 0;
    this.score = 0;
    this.playerTurn = state.currentPlayer;
    this.untriedMoves = getValidMoves(state);
  }

  /**
   * Checks if this node represents a terminal game state.
   */
  get isTerminalNode(): boolean {
    return isTerminalGameState(this.state);
  }

  /**
   * Checks if all possible moves from this node have been expanded.
   */
  get isFullyExpanded(): boolean {
    return this.untriedMoves.length === 0;
  }

  /**
   * Selects the best child node using the UCB1 formula.
   * C is the exploration parameter (sqrt(2) is common).
   */
  selectBestChild(C: number = Math.SQRT2): MonteCarloTreeSearchNode | null {
    let bestScore = -Infinity;
    let bestChild: MonteCarloTreeSearchNode | null = null;

    if (this.children.size === 0) return null; // Should not happen if called correctly

    for (const child of this.children.values()) {
      if (child.visits === 0) {
        // Prioritize unvisited children if any exist during selection
        // This can happen if expansion adds multiple children or if simulation is skipped
        // UCB1 technically undefined for 0 visits, treat as infinite or high value
        return child;
      }

      // UCB1 formula
      const exploitationTerm = child.score / child.visits;
      const explorationTerm =
        C * Math.sqrt(Math.log(this.visits) / child.visits);
      const ucb1Score = exploitationTerm + explorationTerm;

      if (ucb1Score > bestScore) {
        bestScore = ucb1Score;
        bestChild = child;
      }
    }
    return bestChild;
  }
}
