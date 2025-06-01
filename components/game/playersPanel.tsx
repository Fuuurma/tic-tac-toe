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
} from "@/app/game/constants/constants";
import { useEffect, useState } from "react";

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

  // --- State for Display Timer ---
  const [displayTime, setDisplayTime] = useState(0);
  const [progressValue, setProgressValue] = useState(100);

  // --- Effect to update display time based on prop ---
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

  // --- Pre-computation ---
  const winnerName =
    winner && winner !== "draw" ? players[winner]?.username : null;
  const isGameActive = !winner;

  return (
    <div className="w-full max-w-md mx-4 md:mx-0 bg-gradient-to-b from-white to-gray-50 border-2 border-gray-300 rounded-xl shadow-lg p-6 dark:from-gray-700 dark:to-gray-800 dark:border-gray-600">
      {/* Game Mode and Player Type */}
      <div className="text-center mb-4">
        <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-200 drop-shadow-sm">
          {gameMode}
        </h2>
        {playerType && (
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Playing as: <span className="font-medium">{playerType}</span>
          </p>
        )}
      </div>

      {/* Player Badges */}
      <div className="flex justify-around items-center gap-2 flex-wrap">
        <PlayerInfoBadge
          symbol={PlayerSymbol.X}
          username={players.X.username}
          type={players.X.type}
          color={players.X.color}
          isCurrentPlayer={currentPlayer === PlayerSymbol.X && isGameActive}
        />
        <span className="text-gray-500 dark:text-gray-400 font-bold text-lg">
          vs
        </span>
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
        <div className="my-4 text-center">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
            Time Remaining:{" "}
            <span className="font-semibold text-lg">{displayTime}s</span>
          </p>
          <Progress
            value={progressValue}
            className="w-3/4 mx-auto h-2 bg-gray-200 dark:bg-gray-600"
          />
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
    </div>
  );
};

export default PlayersPanel;
