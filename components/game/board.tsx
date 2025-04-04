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
import { PlayerSymbol } from "@/app/game/constants/constants";

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
      <CardHeader className="pb-2">
        <CardTitle className="text-xl">
          {gameState.gameMode}
          {/* {gameState.gameMode === "computer"
            ? "Playing vs Computer"
            : "Multiplayer Game"} */}
        </CardTitle>
        <CardDescription>
          Playing as:{" "}
          <span className="font-bold">{playerType || "Spectator"}</span>
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-3">
        {message && (
          <div className="p-2 bg-blue-50 text-blue-700 rounded-md border border-blue-200">
            {message}
          </div>
        )}

        <div className="flex justify-between text-sm">
          <div className="flex items-center gap-2 px-3 py-1 bg-blue-100 rounded-full">
            <span className="font-bold text-blue-700">X</span>
            <span>{gameState.players.X.username || "Waiting..."}</span>
            <span className="text-xs text-gray-500">
              ({gameState.players.X.type})
            </span>
            {gameState.currentPlayer === PlayerSymbol.X && (
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            )}
          </div>
          <div className="flex items-center gap-2 px-3 py-1 bg-red-100 rounded-full">
            <span className="font-bold text-red-700">O</span>
            <span>{gameState.players.O.username || "Waiting..."}</span>
            <span className="text-xs text-gray-500">
              ({gameState.players.O.type})
            </span>
            {gameState.currentPlayer === PlayerSymbol.O && (
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            )}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 aspect-square w-full">
          {gameState.board.map((cell, i) => {
            const isNextToRemove =
              gameState.nextToRemove.X === i || gameState.nextToRemove.O === i;

            const isCurrentPlayerTurn =
              gameState.currentPlayer === PlayerSymbol.X &&
              !cell &&
              !gameState.winner;

            return (
              <button
                key={i}
                className={`
                  relative h-full w-full rounded-md border-2 flex items-center justify-center 
                  text-3xl font-bold transition-all duration-200
                  ${cell ? "min-h-12" : "min-h-10"}
                  ${
                    cell === "X"
                      ? "bg-blue-100 border-blue-300 text-blue-600"
                      : cell === "O"
                      ? "bg-red-100 border-red-300 text-red-600"
                      : "bg-white border-gray-200 hover:bg-gray-50"
                  } 
                  ${
                    isNextToRemove && gameState.nextToRemove.X === i
                      ? "bg-blue-500 animate-pulse"
                      : ""
                  } 
                  ${
                    isNextToRemove && gameState.nextToRemove.O === i
                      ? "bg-red-500 animate-pulse"
                      : ""
                  } 
                  ${
                    isCurrentPlayerTurn
                      ? "cursor-pointer hover:border-gray-400"
                      : "cursor-default"
                  }
                `}
                onClick={() => handleCellClick(i)}
                disabled={!!cell || !!gameState.winner}
              >
                {cell}
                {isNextToRemove && (
                  <div
                    className="absolute inset-0 animate-wiggle border-2 rounded-md z-10 pointer-events-none"
                    style={{
                      borderColor:
                        gameState.nextToRemove.X === i ? "#2563eb" : "#dc2626",
                    }}
                  />
                )}
              </button>
            );
          })}
        </div>

        {gameState.winner && (
          <div className="text-center p-3 bg-green-100 text-green-800 rounded-md font-medium">
            {gameState.winner === "draw"
              ? "It's a draw!"
              : `Player ${gameState.winner} wins!`}
          </div>
        )}
      </CardContent>

      <CardFooter className="flex justify-between pt-2">
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
