import type { GameState } from "@/app/types/types";
import { makeMove } from "@/app/game/logic/makeMove";
import { match } from "ts-pattern";

export type GameCoreAction =
  | { type: "move"; index: number }
  | { type: "reset"; state: GameState };

export function reduceGameAction(
  state: GameState,
  action: GameCoreAction
): GameState {
  return match(action)
    .with({ type: "move" }, ({ index }) => makeMove(state, index))
    .with({ type: "reset" }, ({ state: resetState }) => resetState)
    .exhaustive();
}
