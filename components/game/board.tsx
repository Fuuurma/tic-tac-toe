import { Card, CardContent, CardFooter } from "@/components/ui/card";

import { GameState, PlayerType } from "@/app/types/types";
import {
  Color,
  GameModes,
  GameStatus,
  PlayerSymbol,
  TURN_DURATION_MS,
} from "@/app/game/constants/constants";
import { BoardCell } from "./boardCell";
import GameButtons from "./gameButtons";
import { useEffect, useState } from "react";

interface GameBoardProps {
  gameState: GameState;
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
    <Card className="w-full max-w-lg mx-4 md:mx-0 shadow-xl border-2 rounded-xl overflow-hidden">
      <CardContent className="p-3 md:p-5">
        {/* Tic Tac Toe Grid */}
        <div className="grid grid-cols-3 gap-2 md:gap-4 aspect-square w-full">
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

      {isOnlineGame && isGameOver && (
        <CardFooter className="flex justify-center py-4 border-t bg-muted/20">
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
      )}
    </Card>
  );
};

export default GameBoard;
