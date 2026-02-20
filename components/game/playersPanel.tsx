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

  return (
    <div className="w-full max-w-lg mx-4 md:mx-0">
      {/* Winner/Game Over Banner */}
      {!isGameActive && winner && (
        <div className="mb-4 bg-gradient-to-r from-amber-500 to-orange-500 text-white px-6 py-4 rounded-xl shadow-lg text-center animate-in zoom-in-95">
          <GameStatusMessage
            message={null}
            winner={winner}
            winningPlayerName={winnerName}
          />
        </div>
      )}

      {/* Main Info Card */}
      <div className="bg-card border-2 rounded-xl shadow-lg p-4">
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
        </div>

        {/* Player Badges */}
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
