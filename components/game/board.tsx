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
import { Color, PlayerSymbol } from "@/app/game/constants/constants";
import { BoardCell } from "./boardCell";

interface GameBoardProps {
  gameState: GameState;
  message: string | null;
  playerType?: PlayerType | null;
  handleCellClick: (index: number) => void;
  resetGame: () => void;
  exitGame: () => void;
}

export const GameBoard: React.FC<GameBoardProps> = ({
  gameState,
  message,
  playerType, // The type of the *user* viewing (e.g., 'Human' if they are playing)
  handleCellClick,
  resetGame,
  exitGame,
}) => {
  const { board, players, currentPlayer, winner, gameMode, nextToRemove } =
    gameState;

  // --- Pre-computation for cleaner rendering ---

  // 1. Create the map of PlayerSymbol -> Color enum for BoardCell styling
  const playerColorsMap: { [key in PlayerSymbol]?: Color } = {
    [PlayerSymbol.X]: players.X.color,
    [PlayerSymbol.O]: players.O.color,
  };

  // 2. Determine the winner's name for a personalized message
  const winnerName =
    winner && winner !== "draw" ? players[winner]?.username : null;

  // 3. Helper to find which symbol is being removed at a given index
  const getRemovalSymbol = (index: number): PlayerSymbol | null => {
    if (nextToRemove.X === index) return PlayerSymbol.X;
    if (nextToRemove.O === index) return PlayerSymbol.O;
    return null;
  };

  // 4. Determine if the game is currently active (no winner)
  const isGameActive = !winner;

  // --- Render Logic ---
  return (
    <Card className="w-full max-w-md mx-auto shadow-lg">
      {" "}
      {/* Center card, add shadow */}
      <CardHeader className="pb-2 text-center">
        <CardTitle className="text-2xl font-semibold">{gameMode}</CardTitle>
        {playerType && ( // Display the role of the person viewing this board
          <CardDescription>
            Playing as: <span className="font-medium">{playerType}</span>
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className="space-y-4 p-4 md:p-6">
        {" "}
        {/* Add padding */}
        {/* Player Info Badges */}
        <div className="flex justify-around items-center gap-2 flex-wrap px-1">
          <PlayerInfoBadge
            symbol={PlayerSymbol.X}
            username={players.X.username}
            type={players.X.type}
            color={players.X.color} // Pass color for badge styling
            isCurrentPlayer={currentPlayer === PlayerSymbol.X && isGameActive}
          />
          <span className="text-muted-foreground font-bold text-lg">vs</span>
          <PlayerInfoBadge
            symbol={PlayerSymbol.O}
            username={players.O.username}
            type={players.O.type}
            color={players.O.color} // Pass color for badge styling
            isCurrentPlayer={currentPlayer === PlayerSymbol.O && isGameActive}
          />
        </div>
        {/* Game Status / Winner Message Area */}
        <div className="min-h-[50px] flex items-center justify-center text-center">
          <GameStatusMessage
            // Show game message only when the game is active
            message={isGameActive ? message : null}
            winner={winner}
            winningPlayerName={winnerName}
          />
        </div>
        {/* Tic Tac Toe Grid */}
        <div className="grid grid-cols-3 gap-2 aspect-square w-full bg-border/40 p-1 rounded-lg">
          {" "}
          {/* Add subtle background/padding */}
          {board.map((cellValue, index) => {
            const isCellNextToRemove =
              nextToRemove.X === index || nextToRemove.O === index;
            const symbolToRemove = getRemovalSymbol(index);
            // Cells are disabled if there's a winner OR if it's not the current player's turn (for AI/network play maybe?)
            // For simple hotseat/local play, just disabling based on winner is enough.
            const isCellDisabled = !!winner; // Adjust if turn logic needed here

            return (
              <BoardCell
                key={index} // Key is essential for list rendering
                index={index}
                value={cellValue}
                playerColors={playerColorsMap} // Pass the color map
                isNextToRemove={isCellNextToRemove}
                removalSymbol={symbolToRemove}
                // Pass final disabled state: game over OR specific cell logic
                isDisabled={isCellDisabled}
                onClick={handleCellClick}
              />
            );
          })}
        </div>
      </CardContent>
      <CardFooter className="flex justify-between pt-4 border-t">
        {" "}
        {/* Add border */}
        <Button
          onClick={resetGame}
          variant="outline"
          // Optionally disable reset button unless game has finished or started
          // disabled={!winner && message !== "Game ready"}
        >
          Reset Game
        </Button>
        <Button onClick={exitGame} variant="destructive">
          {" "}
          {/* Maybe destructive for exit? */}
          Exit Game
        </Button>
      </CardFooter>
    </Card>
  );
};

export default GameBoard;

// export const GameBoard: React.FC<GameBoardProps> = ({
//   gameState,
//   message,
//   playerType,
//   handleCellClick,
//   resetGame,
//   exitGame,
// }) => {
//   return (
//     <Card className="w-full max-w-md">
//       <CardHeader className="pb-2">
//         <CardTitle className="text-xl">
//           {gameState.gameMode}
//         </CardTitle>
//         <CardDescription>
//           Playing as:{" "}
//           <span className="font-bold">{playerType || "Spectator"}</span>
//         </CardDescription>
//       </CardHeader>

//       <CardContent className="space-y-3">
//         {message && (
//           <div className="p-2 bg-blue-50 text-blue-700 rounded-md border border-blue-200">
//             {message}
//           </div>
//         )}

//         <div className="flex justify-between text-sm">
//           <div className="flex items-center gap-2 px-3 py-1 bg-blue-100 rounded-full">
//             <span className="font-bold text-blue-700">X</span>
//             <span>{gameState.players.X.username || "Waiting..."}</span>
//             <span className="text-xs text-gray-500">
//               ({gameState.players.X.type})
//             </span>
//             {gameState.currentPlayer === PlayerSymbol.X && (
//               <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
//             )}
//           </div>
//           <div className="flex items-center gap-2 px-3 py-1 bg-red-100 rounded-full">
//             <span className="font-bold text-red-700">O</span>
//             <span>{gameState.players.O.username || "Waiting..."}</span>
//             <span className="text-xs text-gray-500">
//               ({gameState.players.O.type})
//             </span>
//             {gameState.currentPlayer === PlayerSymbol.O && (
//               <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
//             )}
//           </div>
//         </div>

//         <div className="grid grid-cols-3 gap-2 aspect-square w-full">
//           {gameState.board.map((cell, i) => {
//             const isNextToRemove =
//               gameState.nextToRemove.X === i || gameState.nextToRemove.O === i;

//             const isCurrentPlayerTurn =
//               gameState.currentPlayer === PlayerSymbol.X &&
//               !cell &&
//               !gameState.winner;

//             return (
//               <button
//                 key={i}
//                 className={`
//                   relative h-full w-full rounded-md border-2 flex items-center justify-center
//                   text-3xl font-bold transition-all duration-200
//                   ${cell ? "min-h-12" : "min-h-10"}
//                   ${
//                     cell === "X"
//                       ? "bg-blue-100 border-blue-300 text-blue-600"
//                       : cell === "O"
//                       ? "bg-red-100 border-red-300 text-red-600"
//                       : "bg-white border-gray-200 hover:bg-gray-50"
//                   }
//                   ${
//                     isNextToRemove && gameState.nextToRemove.X === i
//                       ? "bg-blue-500 animate-pulse"
//                       : ""
//                   }
//                   ${
//                     isNextToRemove && gameState.nextToRemove.O === i
//                       ? "bg-red-500 animate-pulse"
//                       : ""
//                   }
//                   ${
//                     isCurrentPlayerTurn
//                       ? "cursor-pointer hover:border-gray-400"
//                       : "cursor-default"
//                   }
//                 `}
//                 onClick={() => handleCellClick(i)}
//                 disabled={!!cell || !!gameState.winner}
//               >
//                 {cell}
//                 {isNextToRemove && (
//                   <div
//                     className="absolute inset-0 animate-wiggle border-2 rounded-md z-10 pointer-events-none"
//                     style={{
//                       borderColor:
//                         gameState.nextToRemove.X === i ? "#2563eb" : "#dc2626",
//                     }}
//                   />
//                 )}
//               </button>
//             );
//           })}
//         </div>

//         {gameState.winner && (
//           <div className="text-center p-3 bg-green-100 text-green-800 rounded-md font-medium">
//             {gameState.winner === "draw"
//               ? "It's a draw!"
//               : `Player ${gameState.winner} wins!`}
//           </div>
//         )}
//       </CardContent>

//       <CardFooter className="flex justify-between pt-2">
//         <Button onClick={resetGame} variant="outline">
//           Reset Game
//         </Button>
//         <Button onClick={exitGame} variant="ghost">
//           Exit Game
//         </Button>
//       </CardFooter>
//     </Card>
//   );
// };

// export default GameBoard;
