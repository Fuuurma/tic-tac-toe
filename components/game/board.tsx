import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { Button } from "@/components/ui/button";
import { GameState, PlayerType } from "@/app/types/types";

interface GameBoardProps {
  gameState: GameState;
  message: string;
  playerType?: PlayerType | null;
  handleCellClick: (index: number) => void;
  resetGame: () => void;
  exitGame: () => void;
}

export const GameBoard: React.FC<GameBoardProps> = ({
  gameState,
  message,
  playerType,
  handleCellClick,
  resetGame,
  exitGame,
}) => {
  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>
          {gameState.gameMode === "computer"
            ? "Playing vs Computer"
            : "Multiplayer Game"}
        </CardTitle>
        <CardDescription>
          Playing as:{" "}
          <span className="font-bold">{playerType || "Spectator"}</span>
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {message && (
          <div className="p-2 bg-blue-50 text-blue-700 rounded-md border border-blue-200">
            {message}
          </div>
        )}

        <div className="flex justify-between text-sm">
          <div className="px-3 py-1 bg-blue-100 rounded-full">
            X: {gameState.players.X || "Waiting..."}
          </div>
          <div className="px-3 py-1 bg-red-100 rounded-full">
            O: {gameState.players.O || "Waiting..."}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-6 aspect-square">
          {gameState.board.map((cell, i) => (
            <button
              key={i}
              className={`h-full w-full rounded-md border-2 flex items-center justify-center text-3xl font-bold transition-all duration-200 ${
                cell === "X"
                  ? "bg-blue-100 border-blue-300 text-blue-600"
                  : cell === "O"
                  ? "bg-red-100 border-red-300 text-red-600"
                  : "bg-white border-gray-200 hover:bg-gray-50"
              } ${
                gameState.nextToRemove.X === i
                  ? "animate-pulse shadow-md border-blue-500 bg-blue-200"
                  : ""
              } ${
                gameState.nextToRemove.O === i
                  ? "animate-pulse shadow-md border-red-500 bg-red-200"
                  : ""
              } ${
                gameState.currentPlayer === playerType &&
                !cell &&
                !gameState.winner
                  ? "cursor-pointer hover:border-gray-400"
                  : "cursor-default"
              }`}
              onClick={() => handleCellClick(i)}
              disabled={!!cell || !!gameState.winner}
            >
              {cell}
            </button>
          ))}
        </div>

        {gameState.winner && (
          <div className="text-center p-3 bg-green-100 text-green-800 rounded-md font-medium">
            {gameState.winner === "draw"
              ? "It's a draw!"
              : `Player ${gameState.winner} wins!`}
          </div>
        )}
      </CardContent>

      <CardFooter className="flex justify-between">
        <Button onClick={resetGame} variant="outline">
          Reset Game
        </Button>
        <Button onClick={exitGame} variant="ghost">
          Exit Game
        </Button>
      </CardFooter>
    </Card>
  );
};

export default GameBoard;
