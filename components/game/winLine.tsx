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

    const [a, , c] = winningCombination;
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
      height: "4px",
      transform: `rotate(${angle}deg)`,
      transformOrigin: "0 50%",
      background: "linear-gradient(90deg, rgba(251, 191, 36, 0.78), rgba(245, 158, 11, 0.88), rgba(251, 191, 36, 0.78))",
      borderRadius: "3px",
      boxShadow: "0 0 10px rgba(251, 191, 36, 0.35)",
      zIndex: 50,
      opacity: 1,
      animation: "winLineDraw 0.45s ease-out forwards",
    });
  }, [winningCombination, boardRef, isVisible]);

  if (!isVisible || !winningCombination) return null;

  return <div style={lineStyle} className="pointer-events-none" aria-hidden="true" />;
};

export default WinLine;
