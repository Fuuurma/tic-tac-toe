import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { GameState, PlayerType } from "@/app/types/types";
import {
  Color,
  GameModes,
  GameStatus,
  PlayerSymbol,
  TURN_DURATION_MS,
} from "@/app/game/constants/constants";
import { BoardCell } from "./boardCell";
import { PlayerInfoBadge } from "./playerBadge";
import { GameStatusMessage } from "./gameStatusMessage";
import GameButtons from "./gameButtons";
import { Progress } from "@/components/ui/progress";
import { useEffect, useState } from "react";

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
  playerType,
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
  const {
    board,
    players,
    currentPlayer,
    winner,
    gameMode,
    nextToRemove,
    turnTimeRemaining,
    gameStatus,
  } = gameState;

  // --- State for Display Timer ---
  // We use local state for the display value derived from the prop
  // to potentially format it or handle smooth updates if desired.
  const [displayTime, setDisplayTime] = useState(0);
  const [progressValue, setProgressValue] = useState(100);

  // --- Effect to update display time based on prop ---
  useEffect(() => {
    if (gameStatus === GameStatus.ACTIVE && turnTimeRemaining !== undefined) {
      const secondsLeft = Math.ceil(turnTimeRemaining / 1000);
      setDisplayTime(secondsLeft);
      // Calculate progress percentage
      const progress = Math.max(
        0,
        (turnTimeRemaining / TURN_DURATION_MS) * 100
      );
      setProgressValue(progress);
    } else {
      // Reset or hide timer when game not running
      setDisplayTime(0);
      setProgressValue(0); // Or 100 if you prefer it full when inactive
    }
  }, [turnTimeRemaining, gameStatus]); // Update when timer prop or status changes

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
  if (!isGameActive && (winner === PlayerSymbol.O || winner === PlayerSymbol.X))
    gameState.gameStatus = GameStatus.COMPLETED;

  const isOnlineGame = gameMode === GameModes.ONLINE;

  const isLocalGame =
    gameMode === GameModes.VS_COMPUTER || gameMode === GameModes.VS_FRIEND;

  return (
    <Card className="w-full max-w-md shadow-lg mx-4 md:mx-0">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-semibold">{gameMode}</CardTitle>
        {playerType && (
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
            color={players.X.color}
            isCurrentPlayer={currentPlayer === PlayerSymbol.X && isGameActive}
          />
          <span className="text-muted-foreground font-bold text-lg">vs</span>
          <PlayerInfoBadge
            symbol={PlayerSymbol.O}
            username={players.O.username}
            type={players.O.type}
            color={players.O.color}
            isCurrentPlayer={currentPlayer === PlayerSymbol.O && isGameActive}
          />
        </div>

        {/* Timer Display Area */}
        {isGameActive && turnTimeRemaining !== undefined && (
          <div className="my-2 text-center">
            <p className="text-sm text-muted-foreground mb-1">
              Time Remaining:{" "}
              <span className="font-semibold text-lg">{displayTime}s</span>
            </p>
            {/* Optional: Progress Bar visual */}
            <Progress value={progressValue} className="w-3/4 mx-auto h-2" />
          </div>
        )}

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
          {board.map((cellValue, index) => {
            const isCellNextToRemove =
              nextToRemove.X === index || nextToRemove.O === index;
            const symbolToRemove = getRemovalSymbol(index);
            const isCellDisabled = !!winner;

            return (
              <BoardCell
                key={index}
                index={index}
                value={cellValue}
                playerColors={playerColorsMap}
                isNextToRemove={isCellNextToRemove}
                removalSymbol={symbolToRemove}
                isDisabled={isCellDisabled}
                onClick={handleCellClick}
              />
            );
          })}
        </div>
      </CardContent>

      <CardFooter className="flex justify-between pt-4 border-t">
        <GameButtons
          isOnlineGame={isOnlineGame}
          isLocalGame={isLocalGame}
          isGameOver={isGameOver}
          rematchOffered={rematchOffered}
          rematchRequested={rematchRequested}
          onAcceptRematch={onAcceptRematch}
          onDeclineRematch={onDeclineRematch}
          onLeaveRoom={onLeaveRoom}
          onRequestRematch={onRequestRematch}
          resetGame={resetGame}
          exitGame={exitGame}
        />
      </CardFooter>
    </Card>
  );
};

export default GameBoard;
