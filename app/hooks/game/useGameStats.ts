"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { GameStats, loadStats, recordResult } from "@/components/game/statsPanel";
import { GameStatus } from "@/app/game/constants/constants";
import { PlayerSymbol } from "@/app/game/constants/constants";

export const useGameStats = (
  gameStatus: GameStatus,
  winner: PlayerSymbol | "draw" | null,
  playerSymbol: PlayerSymbol | null,
  isLoggedIn: boolean
) => {
  const [stats, setStats] = useState<GameStats>(loadStats);
  const resultRecordedRef = useRef(false);

  useEffect(() => {
    if (gameStatus === GameStatus.COMPLETED && !resultRecordedRef.current && isLoggedIn) {
      resultRecordedRef.current = true;

      let result: "win" | "loss";
      if (winner === playerSymbol) {
        result = "win";
      } else {
        result = "loss";
      }

      const newStats = recordResult(stats, result);
      setStats(newStats);
    }

    if (gameStatus === GameStatus.ACTIVE || gameStatus === GameStatus.WAITING) {
      resultRecordedRef.current = false;
    }
  }, [gameStatus, winner, isLoggedIn, playerSymbol, stats]);

  const refreshStats = useCallback(() => {
    setStats(loadStats());
  }, []);

  return { stats, setStats, refreshStats };
};
