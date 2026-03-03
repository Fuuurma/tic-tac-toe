"use client";

import React, { useEffect, useState } from "react";
import { PlayerInfoBadge } from "./playerBadge";
import { GameStatusMessage } from "./gameStatusMessage";
import { GameState, PlayerType } from "@/app/types/types";
import {
  GameStatus,
  PlayerSymbol,
  TURN_DURATION_MS,
  PlayerTypes,
} from "@/app/game/constants/constants";
import { Loader2, RotateCcw, LogOut, Clock, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ShareButton } from "../common/shareButton";
import { cn } from "@/lib/utils";

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
  const [timerPulse, setTimerPulse] = useState(false);

  useEffect(() => {
    if (gameStatus === GameStatus.ACTIVE && turnTimeRemaining !== undefined) {
      const secondsLeft = Math.ceil(turnTimeRemaining / 1000);
      setDisplayTime(secondsLeft);
      const progress = Math.max(
        0,
        (turnTimeRemaining / TURN_DURATION_MS) * 100
      );
      setProgressValue(progress);
      
      // Pulse animation when under 3 seconds
      setTimerPulse(secondsLeft <= 3 && secondsLeft > 0);
    } else {
      setDisplayTime(0);
      setProgressValue(0);
      setTimerPulse(false);
    }
  }, [turnTimeRemaining, gameStatus]);

  const isGameActive = !winner;
  const isXTurn = currentPlayer === PlayerSymbol.X && isGameActive;
  const isOTurn = currentPlayer === PlayerSymbol.O && isGameActive;
  const isAITurn = isOTurn && players.O.type === PlayerTypes.COMPUTER;
  const isWaiting = gameStatus === GameStatus.WAITING;

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

  // Get timer color based on remaining time
  const getTimerColor = () => {
    if (displayTime <= 3) return "text-red-500";
    if (displayTime <= 6) return "text-amber-500";
    return "text-emerald-500";
  };

  // Get progress bar gradient based on remaining time
  const getProgressGradient = () => {
    if (displayTime <= 3) return "from-red-500 to-red-600";
    if (displayTime <= 6) return "from-amber-500 to-orange-500";
    return "from-emerald-400 to-emerald-500";
  };

  return (
    <div className="w-full mx-2 sm:mx-4">
      {/* Matchmaking Loading State */}
      {isWaiting && (
        <div className="bg-card/80 backdrop-blur-md border-2 rounded-xl shadow-xl p-6 animate-in fade-in glassmorphism">
          <div className="flex flex-col items-center justify-center gap-4">
            <div className="relative">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <div className="absolute inset-0 h-12 w-12 animate-ping rounded-full bg-primary/20" />
            </div>
            <div className="text-center">
              <h3 className="text-lg font-bold text-foreground">Waiting for Opponent</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {message || "Finding a player..."}
              </p>
            </div>
            <div className="flex gap-2 mt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={onExit}
                className="gap-1"
              >
                <LogOut className="h-3 w-3" />
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Winner/Game Over Banner */}
      {!isGameActive && winner && (
        <div className={cn(
          "mb-4 bg-gradient-to-r text-white px-4 py-4 rounded-xl shadow-2xl animate-in zoom-in-95 border-2 border-white/30",
          getWinnerColor()
        )}>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center justify-center gap-3 flex-1">
              {winner !== "draw" && (
                <span className={cn("text-4xl font-bold drop-shadow-lg", getWinnerSymbolColor())}>
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
              <ShareButton 
                title={winner === "draw" ? "Tic Tac Toe - Draw!" : `Tic Tac Toe - ${winnerName} Wins!`}
                text={winner === "draw" ? "We tied! Can you beat me?" : `${winnerName} won! Can you beat me?`}
              />
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
      <div className="bg-card/80 backdrop-blur-md border-2 rounded-xl shadow-xl p-3 sm:p-4 glassmorphism">
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
                className="gap-1 hover:bg-accent transition-colors"
              >
                <RotateCcw className="h-3 w-3" />
                New
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onExit}
                className="gap-1 text-muted-foreground hover:text-destructive transition-colors"
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
              <div className="relative">
                <div className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                <div className="absolute inset-0 h-2 w-2 rounded-full bg-amber-500 animate-ping" />
              </div>
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

        {/* Enhanced Timer */}
        {isGameActive && turnTimeRemaining !== undefined && (
          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground flex items-center gap-2">
                {isAITurn ? (
                  <span className="flex items-center gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    AI thinking...
                  </span>
                ) : (
                  <>
                    <Clock className="h-3 w-3" />
                    {players[currentPlayer]?.username}&apos;s turn
                  </>
                )}
              </span>
              <span className={cn(
                "font-mono font-bold text-lg tabular-nums transition-colors duration-300",
                getTimerColor(),
                timerPulse && "animate-timer-pulse"
              )}>
                {displayTime}s
                {timerPulse && <AlertCircle className="inline-block h-4 w-4 ml-1 animate-bounce" />}
              </span>
            </div>
            
            {/* Progress Bar with Gradient */}
            <div className="relative h-3 bg-muted rounded-full overflow-hidden">
              <div 
                className={cn(
                  "absolute inset-y-0 left-0 rounded-full transition-all duration-300 ease-out bg-gradient-to-r",
                  getProgressGradient()
                )}
                style={{ width: `${progressValue}%` }}
              >
                {/* Shine effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
              </div>
              
              {/* Low time indicator segments */}
              <div className="absolute inset-0 flex">
                {[...Array(10)].map((_, i) => (
                  <div 
                    key={i} 
                    className="flex-1 border-r border-background/20 last:border-r-0"
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PlayersPanel;
