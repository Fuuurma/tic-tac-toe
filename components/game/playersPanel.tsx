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

  // --- State for Transient Message ---
  const [showMessage, setShowMessage] = useState(false);

  // --- Effect to update display time ---
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

  // --- Effect to handle transient message ---
  useEffect(() => {
    if (message && gameStatus === GameStatus.ACTIVE) {
      setShowMessage(true);
      const timer = setTimeout(() => setShowMessage(false), 10000); // Hide after 10 seconds
      return () => clearTimeout(timer); // Cleanup on unmount or message change
    } else {
      setShowMessage(false);
    }
  }, [message, gameStatus]);

  // --- Pre-computation ---
  const winnerName =
    winner && winner !== "draw" ? players[winner]?.username : null;
  const isGameActive = !winner;

  return (
    <div className="relative w-full max-w-md mx-4 md:mx-0 bg-gradient-to-b from-white to-gray-50 border-2 border-gray-300 rounded-xl shadow-lg p-4 dark:from-gray-700 dark:to-gray-800 dark:border-gray-600">
      {/* Transient Game Status Message */}
      {showMessage && message && isGameActive && (
        <div className="absolute top-2 left-1/2 transform -translate-x-1/2 bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-600 dark:to-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1 shadow-md text-sm text-gray-800 dark:text-gray-200 animate-fade-in">
          <GameStatusMessage
            message={message}
            winner={null}
            winningPlayerName={null}
          />
        </div>
      )}
      {!isGameActive && winner && (
        <div className="absolute top-2 left-1/2 z-50 transform -translate-x-1/2 bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-600 dark:to-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg  shadow-md text-sm text-gray-800 dark:text-gray-200">
          <GameStatusMessage
            message={null}
            winner={winner}
            winningPlayerName={winnerName}
          />
        </div>
      )}

      {/* Game Mode and Player Type */}
      <div className="text-center mb-3">
        <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 drop-shadow-sm">
          {gameMode}
        </h2>
        {playerType && (
          <p className="text-xs text-gray-600 dark:text-gray-400">
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
        <span className="text-gray-500 dark:text-gray-400 font-bold text-base">
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
        <div className="mt-3 text-center">
          <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">
            Time:{" "}
            <span className="font-semibold text-base">{displayTime}s</span>
          </p>
          <Progress
            value={progressValue}
            className="w-2/3 mx-auto h-1.5 bg-gray-200 dark:bg-gray-600"
          />
        </div>
      )}
    </div>
  );
};

export default PlayersPanel;
