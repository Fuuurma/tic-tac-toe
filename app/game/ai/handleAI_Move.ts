import { GameState } from "@/app/types/types";
import { findRandomValidMove } from "../logic/makeRandomMove";
import { CanMakeMove } from "../logic/canMakeMove";
import { AI_Difficulty, GameModes, PlayerSymbol } from "../constants/constants";

export async function handleAI_Move(
  gameState: GameState,
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  aiDifficulty: AI_Difficulty
): Promise<void> {
  const minMoveTime = 500;

  await new Promise((resolve) => setTimeout(resolve, minMoveTime));

  const randomMoveIndex = findRandomValidMove(gameState);

  if (randomMoveIndex !== null && CanMakeMove(GameModes.VS_COMPUTER, gameState.currentPlayer, PlayerSymbol.O)) {
    const newState = await makeAIMove(gameState, randomMoveIndex);
    setGameState(newState);
  }
}

async function makeAIMove(
  gameState: GameState,
  moveIndex: number
): Promise<GameState> {
  return new Promise((resolve) => {
    setTimeout(() => {
      const newState = {
        ...gameState,
        board: [...gameState.board],
      };

      const playerMoves = [...gameState.moves[PlayerSymbol.O]];

      // Check if player already has 3 pieces on board
      if (playerMoves.length >= 3) {
        const oldestMoveIndex = playerMoves.shift() as number;
        newState.board[oldestMoveIndex] = null;
      }

      playerMoves.push(moveIndex);
      newState.moves[PlayerSymbol.O] = playerMoves;
      newState.board[moveIndex] = PlayerSymbol.O;

      const { checkWinner } = require("../logic/checkWinner");
      newState.winner = checkWinner(newState.board);

      if (!newState.winner) {
        newState.currentPlayer = PlayerSymbol.X;
      }

      resolve(newState);
    }, 500);
  });
}
