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
import { Loader2 } from "lucide-react";

interface PlayersPanelProps {
  gameState: GameState;
  message: string | null;
  playerType?: PlayerType | null;
}

export const PlayersPanel: React.FC<PlayersPanelProps> = ({
  gameState,
  message,
  playerType,
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
  const [showMessage, setShowMessage] = useState(false);

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

  useEffect(() => {
    if (message && gameStatus === GameStatus.ACTIVE) {
      setShowMessage(true);
      const timer = setTimeout(() => setShowMessage(false), 3000);
      return () => clearTimeout(timer);
    } else {
      setShowMessage(false);
    }
  }, [message, gameStatus]);

  const winnerName =
    winner && winner !== "draw" ? players[winner]?.username : null;
  const isGameActive = !winner;

  const isXTurn = currentPlayer === PlayerSymbol.X && isGameActive;
  const isOTurn = currentPlayer === PlayerSymbol.O && isGameActive;
  const isAITurn = isOTurn && players.O.type === PlayerTypes.COMPUTER;

  return (
    <div className="relative w-full max-w-md mx-4 md:mx-0 bg-card border-2 rounded-xl shadow-lg p-4">
      {/* Status Messages */}
      {showMessage && message && isGameActive && (
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-primary/90 text-primary-foreground px-4 py-2 rounded-lg shadow-lg text-sm font-medium animate-in slide-in-from-top-2 fade-in">
          {message}
        </div>
      )}
      
      {!isGameActive && winner && (
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-gradient-to-r from-amber-500 to-orange-500 text-white px-6 py-2 rounded-lg shadow-lg text-sm font-bold animate-in zoom-in-95">
          <GameStatusMessage
            message={null}
            winner={winner}
            winningPlayerName={winnerName}
          />
        </div>
      )}

      {/* Game Mode Header */}
      <div className="text-center mb-4">
        <h2 className="text-lg font-bold text-foreground uppercase tracking-wider">
          {gameMode.replace("_", " ")}
        </h2>
        {playerType && (
          <p className="text-xs text-muted-foreground mt-1">
            Playing as: <span className="font-medium">{playerType}</span>
          </p>
        )}
      </div>

      {/* Player Badges - Enhanced */}
      <div className="flex justify-between items-center gap-3">
        <PlayerInfoBadge
          symbol={PlayerSymbol.X}
          username={players.X.username}
          type={players.X.type}
          color={players.X.color}
          isCurrentPlayer={isXTurn}
        />
        
        <div className="flex flex-col items-center gap-1">
          <span className="text-sm font-bold text-muted-foreground">VS</span>
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

      {/* Timer - Enhanced */}
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
  );
};

export default PlayersPanel;
