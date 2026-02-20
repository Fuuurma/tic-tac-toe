"use client";
import React from "react";
import { PlayerInfoBadge } from "./playerBadge";
import { GameStatusMessage } from "./gameStatusMessage";
import { Progress } from "@/components/ui/progress";
import { GameState, PlayerType } from "@/app/types/types";
import {
  GameStatus,
  PlayerSymbol,
  TURN_DURATION_MS,
  PlayerTypes,
} from "@/app/game/constants/constants";
import { useEffect, useState } from "react";
import { Loader2, RotateCcw, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PlayersPanelProps {
  gameState: GameState;
  message: string | null;
  playerType?: PlayerType | null;
  onNewGame: () => void;
  onExit: () => void;
}

export const PlayersPanel: React.FC<PlayersPanelProps> = ({
  gameState,
  message,
  playerType,
  onNewGame,
  onExit,
}) => {
  const {
    players,
    currentPlayer,
    winner,
    gameMode,
    turnTimeRemaining,
    gameStatus,
  } = gameState;

  const [displayTime, setDisplayTime] = useState(0);
  const [progressValue, setProgressValue] = useState(100);

  useEffect(() => {
    if (gameStatus === GameStatus.ACTIVE && turnTimeRemaining !== undefined) {
      const secondsLeft = Math.ceil(turnTimeRemaining / 1000);
      setDisplayTime(secondsLeft);
      const progress = Math.max(
        0,
        (turnTimeRemaining / TURN_DURATION_MS) * 100
      );
      setProgressValue(progress);
    } else {
      setDisplayTime(0);
      setProgressValue(0);
    }
  }, [turnTimeRemaining, gameStatus]);

  const isGameActive = !winner;
  const isXTurn = currentPlayer === PlayerSymbol.X && isGameActive;
  const isOTurn = currentPlayer === PlayerSymbol.O && isGameActive;
  const isAITurn = isOTurn && players.O.type === PlayerTypes.COMPUTER;

  const winnerName =
    winner && winner !== "draw" ? players[winner]?.username : null;

  const getWinnerColor = () => {
    if (!winner || winner === "draw") return "from-amber-500 to-orange-600";
    const playerColor = players[winner]?.color;
    if (!playerColor) return "from-amber-500 to-orange-600";
    
    const colorMap: Record<string, string> = {
      BLUE: "from-blue-400 to-blue-600",
      RED: "from-red-400 to-red-600",
      GREEN: "from-green-400 to-green-600",
      YELLOW: "from-yellow-400 to-yellow-600",
      PURPLE: "from-purple-400 to-purple-600",
      PINK: "from-pink-400 to-pink-600",
      ORANGE: "from-orange-400 to-orange-600",
      GRAY: "from-gray-400 to-gray-600",
    };
    return colorMap[playerColor] || "from-amber-500 to-orange-600";
  };

  const getWinnerSymbolColor = () => {
    if (!winner || winner === "draw") return "text-white";
    const playerColor = players[winner]?.color;
    if (!playerColor) return "text-white";
    
    const colorMap: Record<string, string> = {
      BLUE: "text-blue-100",
      RED: "text-red-100",
      GREEN: "text-green-100",
      YELLOW: "text-yellow-100",
      PURPLE: "text-purple-100",
      PINK: "text-pink-100",
      ORANGE: "text-orange-100",
      GRAY: "text-gray-100",
    };
    return colorMap[playerColor] || "text-white";
  };

  return (
    <div className="w-full max-w-lg mx-2 sm:mx-4 md:mx-0">
      {/* Winner/Game Over Banner */}
      {!isGameActive && winner && (
        <div className={`mb-4 bg-gradient-to-r ${getWinnerColor()} text-white px-4 py-3 rounded-xl shadow-lg animate-in zoom-in-95 border-2 border-white/30`}>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center justify-center gap-3 flex-1">
              {winner !== "draw" && (
                <span className={`text-3xl font-bold ${getWinnerSymbolColor()}`}>
                  {winner}
                </span>
              )}
              <GameStatusMessage
                message={null}
                winner={winner}
                winningPlayerName={winnerName}
              />
            </div>
            <div className="flex gap-2 shrink-0">
              <Button
                variant="secondary"
                size="sm"
                onClick={onNewGame}
                className="gap-1 bg-white/20 hover:bg-white/30 border-0 text-white hover:text-white"
              >
                <RotateCcw className="h-3 w-3" />
                <span className="hidden sm:inline">New</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onExit}
                className="gap-1 text-white/80 hover:text-white hover:bg-white/20"
              >
                <LogOut className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Main Info Card */}
      <div className="bg-card border-2 rounded-xl shadow-lg p-3 sm:p-4">
        {/* Header with Game Mode and Actions */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-foreground uppercase tracking-wider">
              {gameMode.replace("_", " ")}
            </h2>
            {playerType && (
              <p className="text-xs text-muted-foreground">
                Playing as: <span className="font-medium">{playerType}</span>
              </p>
            )}
          </div>
          {/* Hide buttons when game is over (shown in banner instead) */}
          {isGameActive && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={onNewGame}
                className="gap-1"
              >
                <RotateCcw className="h-3 w-3" />
                New
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onExit}
                className="gap-1 text-muted-foreground hover:text-destructive"
              >
                <LogOut className="h-3 w-3" />
              </Button>
            </div>
          )}
        </div>

        {/* Player Badges */}
        <div className="flex justify-center items-center gap-2 sm:gap-3">
          <PlayerInfoBadge
            symbol={PlayerSymbol.X}
            username={players.X.username}
            type={players.X.type}
            color={players.X.color}
            isCurrentPlayer={isXTurn}
          />
          
          <div className="flex flex-col items-center gap-1 px-1">
            <span className="text-xs sm:text-sm font-bold text-muted-foreground">VS</span>
            {isGameActive && (
              <div className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
            )}
          </div>

          <PlayerInfoBadge
            symbol={PlayerSymbol.O}
            username={players.O.username}
            type={players.O.type}
            color={players.O.color}
            isCurrentPlayer={isOTurn}
          />
        </div>

        {/* Timer */}
        {isGameActive && turnTimeRemaining !== undefined && (
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {isAITurn ? (
                  <span className="flex items-center gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    AI thinking...
                  </span>
                ) : (
                  `${players[currentPlayer]?.username}'s turn`
                )}
              </span>
              <span className={`font-mono font-bold ${
                displayTime <= 3 ? "text-destructive" : "text-foreground"
              }`}>
                {displayTime}s
              </span>
            </div>
            <Progress 
              value={progressValue} 
              className={`h-2 ${
                displayTime <= 3 ? "[&>div]:bg-destructive" : "[&>div]:bg-primary"
              }`}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default PlayersPanel;
