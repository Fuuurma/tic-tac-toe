import type { GameState } from "@/app/types/types";
import { makeMove } from "@/app/game/logic/makeMove";

export type GameCoreAction =
  | { type: "move"; index: number }
  | { type: "reset"; state: GameState };

export function reduceGameAction(
  state: GameState,
  action: GameCoreAction
): GameState {
  if (action.type === "reset") return action.state;
  return makeMove(state, action.index);
}
