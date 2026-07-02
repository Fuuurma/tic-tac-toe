"use client";

import { useEffect, useRef } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { GameState } from "@/app/types/types";
import type { PlayerSymbol } from "@/src/game/core";
import { buildMatchResultPayload } from "@/app/utils/convex/matchResultPayload";

interface MatchResultRecorderProps {
  gameState: GameState;
  localPlayerSymbol: PlayerSymbol | null;
}

export function MatchResultRecorder({ gameState, localPlayerSymbol }: MatchResultRecorderProps) {
  const recordMatchResult = useMutation(api.stats.recordMatchResult);
  const recordedKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!gameState.winner || localPlayerSymbol !== gameState.winner) {
      return;
    }

    const payload = buildMatchResultPayload(gameState);

    if (!payload) {
      recordedKeyRef.current = null;
      return;
    }

    const recordKey = [
      payload.dedupeKey || payload.gameMode,
      payload.winner.profileId || payload.winner.guestId,
      payload.loser.profileId || payload.loser.guestId,
      payload.movesCount,
      gameState.winningCombination?.join("-") || "timeout",
    ].join(":");

    if (recordedKeyRef.current === recordKey) {
      return;
    }

    recordedKeyRef.current = recordKey;

    void recordMatchResult(payload).catch((error) => {
      recordedKeyRef.current = null;
      console.warn("Failed to record match result", error);
    });
  }, [gameState, localPlayerSymbol, recordMatchResult]);

  return null;
}
