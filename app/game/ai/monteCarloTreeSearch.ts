import { GameState } from "@/app/types/types";
import { PlayerSymbol } from "../constants/constants";

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
}
