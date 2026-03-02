"use client";

import { useCallback, useRef, useEffect } from "react";

type SoundType = "place" | "win" | "draw" | "warning" | "click";

interface SoundOptions {
  volume?: number;
}

export function useSound() {
  const audioContextRef = useRef<AudioContext | null>(null);
  const enabledRef = useRef(true);

  useEffect(() => {
    const saved = localStorage.getItem("soundEnabled");
    enabledRef.current = saved !== "false";
  }, []);

  const playTone = useCallback(
    (frequency: number, duration: number, type: OscillatorType = "sine") => {
      if (!enabledRef.current) return;

      try {
        if (!audioContextRef.current) {
          audioContextRef.current = new AudioContext();
        }

        const ctx = audioContextRef.current;
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);

        oscillator.frequency.value = frequency;
        oscillator.type = type;

        gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);

        oscillator.start(ctx.currentTime);
        oscillator.stop(ctx.currentTime + duration);
      } catch (e) {
        console.error("Audio playback failed:", e);
      }
    },
    []
  );

  const play = useCallback(
    (type: SoundType) => {
      if (!enabledRef.current) return;

      switch (type) {
        case "place":
          playTone(440, 0.1);
          break;
        case "win":
          playTone(523.25, 0.15);
          setTimeout(() => playTone(659.25, 0.15), 150);
          setTimeout(() => playTone(783.99, 0.3), 300);
          break;
        case "draw":
          playTone(392, 0.2);
          setTimeout(() => playTone(349.23, 0.2), 200);
          break;
        case "warning":
          playTone(220, 0.1, "square");
          break;
        case "click":
          playTone(600, 0.05);
          break;
      }
    },
    [playTone]
  );

  const setEnabled = useCallback((enabled: boolean) => {
    enabledRef.current = enabled;
    localStorage.setItem("soundEnabled", String(enabled));
  }, []);

  const isEnabled = useCallback(() => enabledRef.current, []);

  return { play, setEnabled, isEnabled };
}
