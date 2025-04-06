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
import {
  Color,
  GameStatus,
  PlayerSymbol,
} from "@/app/game/constants/constants";
import { BoardCell } from "./boardCell";
import { PlayerInfoBadge } from "./playerBadge";
import { GameStatusMessage } from "./gameStatusMessage";

interface GameBoardProps {
  gameState: GameState;
  message: string | null;
  playerType?: PlayerType | null;
  handleCellClick: (index: number) => void;
  resetGame: () => void;
  exitGame: () => void;
  isGameOver: boolean;
  rematchOffered: boolean;
  rematchRequested: boolean;
  onRequestRematch: () => void;
  onAcceptRematch: () => void;
  onDeclineRematch: () => void;
  onLeaveRoom: () => void;
}

export const GameBoard: React.FC<GameBoardProps> = ({
  gameState,
  message,
  playerType, // The type of the *user* viewing (e.g., 'Human' if they are playing)
  handleCellClick,
  resetGame,
  exitGame,
  isGameOver,
  rematchOffered,
  rematchRequested,
  onRequestRematch,
  onAcceptRematch,
  onDeclineRematch,
  onLeaveRoom,
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

  // 5. If game has finished update state
  // do we need to use state no? this will only do onrender
  if (!isGameActive && (winner === PlayerSymbol.O || winner === PlayerSymbol.X))
    gameState.gameStatus = GameStatus.COMPLETED;

  // --- Render Logic ---
  return (
    <Card className="w-full max-w-md shadow-lg mx-4 md:mx-0">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-semibold">{gameMode}</CardTitle>
        {playerType && ( // Display the role of the person viewing this board
          <CardDescription>
            Playing as: <span className="font-medium">{playerType}</span>
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className="md:p-6">
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
            message={isGameActive ? message : null}
            winner={winner}
            winningPlayerName={winnerName}
          />
        </div>
        {/* Tic Tac Toe Grid */}
        <div className="grid grid-cols-3 gap-2 aspect-square w-full bg-border/40 p-1 rounded-lg">
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
        {/* {" "}
        <Button
          onClick={resetGame}
          variant="outline"
          // Optionally disable reset button unless game has finished or started
          // disabled={!winner && message !== "Game ready"}
        >
          Reset Game
        </Button>
        <Button onClick={exitGame} variant="destructive">
          Exit Game
        </Button> */}

        {isGameOver ? (
          <>
            {rematchOffered ? (
              <div className="flex flex-col sm:flex-row gap-2 w-full">
                <Button
                  onClick={onAcceptRematch}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                >
                  Accept Rematch
                </Button>
                <Button
                  onClick={onDeclineRematch}
                  variant="outline"
                  className="flex-1"
                >
                  Decline
                </Button>
                <Button
                  onClick={onLeaveRoom}
                  variant="destructive"
                  className="flex-1"
                >
                  Leave Room
                </Button>
              </div>
            ) : rematchRequested ? (
              <div className="flex gap-2 w-full items-center">
                <span className="text-sm text-muted-foreground flex-1 text-center">
                  Waiting for opponent...
                </span>
                <Button onClick={onLeaveRoom} variant="destructive">
                  Leave Room
                </Button>
              </div>
            ) : (
              <div className="flex gap-2 w-full">
                <Button onClick={onRequestRematch} className="flex-1">
                  Request Rematch
                </Button>
                <Button
                  onClick={onLeaveRoom}
                  variant="destructive"
                  className="flex-1"
                >
                  Leave Room
                </Button>
              </div>
            )}
          </>
        ) : (
          <>
            {/* Buttons for active game - maybe disable reset during active online game? */}
            <Button variant="outline" disabled>
              Reset (N/A)
            </Button>
            <Button onClick={onLeaveRoom} variant="destructive">
              Exit Game
            </Button>
          </>
        )}
      </CardFooter>
    </Card>
  );
};

export default GameBoard;
