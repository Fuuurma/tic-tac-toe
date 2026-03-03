"use client";

import React, { useEffect, useState } from "react";
import { WinningLine } from "@/app/types/types";

interface WinLineProps {
  winningCombination: WinningLine | null;
  boardRef: React.RefObject<HTMLDivElement | null>;
  isVisible: boolean;
}

export const WinLine: React.FC<WinLineProps> = ({
  winningCombination,
  boardRef,
  isVisible,
}) => {
  const [lineStyle, setLineStyle] = useState<React.CSSProperties>({});

  useEffect(() => {
    if (!winningCombination || !boardRef.current || !isVisible) {
      setLineStyle({ opacity: 0 });
      return;
    }

    const board = boardRef.current;
    const cells = board.querySelectorAll('[role="gridcell"]');
    
    if (cells.length !== 9) return;

    const [a, b, c] = winningCombination;
    const cellA = cells[a] as HTMLElement;
    const cellC = cells[c] as HTMLElement;

    if (!cellA || !cellC) return;

    const boardRect = board.getBoundingClientRect();
    const rectA = cellA.getBoundingClientRect();
    const rectC = cellC.getBoundingClientRect();

    // Calculate center points relative to board
    const x1 = rectA.left + rectA.width / 2 - boardRect.left;
    const y1 = rectA.top + rectA.height / 2 - boardRect.top;
    const x2 = rectC.left + rectC.width / 2 - boardRect.left;
    const y2 = rectC.top + rectC.height / 2 - boardRect.top;

    // Calculate length and angle
    const length = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
    const angle = Math.atan2(y2 - y1, x2 - x1) * (180 / Math.PI);

    setLineStyle({
      position: "absolute",
      left: `${x1}px`,
      top: `${y1}px`,
      width: `${length}px`,
      height: "6px",
      transform: `rotate(${angle}deg)`,
      transformOrigin: "0 50%",
      background: "linear-gradient(90deg, #fbbf24, #f59e0b, #fbbf24)",
      borderRadius: "3px",
      boxShadow: "0 0 20px rgba(251, 191, 36, 0.8), 0 0 40px rgba(251, 191, 36, 0.4)",
      zIndex: 50,
      opacity: 1,
      animation: "winLineDraw 0.6s ease-out forwards, winLineGlow 1.5s ease-in-out infinite alternate",
    });
  }, [winningCombination, boardRef, isVisible]);

  if (!isVisible || !winningCombination) return null;

  return <div style={lineStyle} className="pointer-events-none" aria-hidden="true" />;
};

export default WinLine;
