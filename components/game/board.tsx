"use client";

import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { GameState, WinningLine } from "@/app/types/types";
import {
  Color,
  GameModes,
  GameStatus,
  PlayerSymbol,
} from "@/app/game/constants/constants";
import { BoardCell } from "./boardCell";
import GameButtons from "./gameButtons";
import WinLine from "./winLine";
import ParticleEffects from "./particleEffects";
import { useEffect, useRef, useState, useCallback } from "react";

interface GameBoardProps {
  gameState: GameState;
  handleCellClick: (index: number) => void;
  resetGame: () => void;
  exitGame: () => void;
  isGameOver: boolean;
  rematchOffered: boolean;
  rematchRequested: boolean;
  onRequestRematch: () => void;
  onAcceptRematch: () => void;
  onDeclineRematch: () => void;
  onLeaveRoom: () => void;
  winningCombination: WinningLine | null;
  lastMoveIndex: number | null;
}

export const GameBoard: React.FC<GameBoardProps> = ({
  gameState,
  handleCellClick,
  resetGame,
  exitGame,
  isGameOver,
  rematchOffered,
  rematchRequested,
  onRequestRematch,
  onAcceptRematch,
  onDeclineRematch,
  onLeaveRoom,
  winningCombination,
  lastMoveIndex,
}) => {
  const {
    board,
    players,
    currentPlayer,
    winner,
    gameMode,
    nextToRemove,
    gameStatus,
  } = gameState;

  const boardRef = useRef<HTMLDivElement>(null);
  const [showWinLine, setShowWinLine] = useState(false);
  const [showParticles, setShowParticles] = useState(false);
  const [previousWinner, setPreviousWinner] = useState<PlayerSymbol | "draw" | null>(null);
  const [newMoveIndex, setNewMoveIndex] = useState<number | null>(null);

  useEffect(() => {
    if (lastMoveIndex !== undefined && lastMoveIndex !== null) {
      setNewMoveIndex(lastMoveIndex);
      const timer = setTimeout(() => setNewMoveIndex(null), 500);
      return () => clearTimeout(timer);
    }
  }, [lastMoveIndex]);

  useEffect(() => {
    if (winner && winner !== previousWinner) {
      setPreviousWinner(winner);
      
      if (winner !== "draw") {
        const winLineTimer = setTimeout(() => setShowWinLine(true), 300);
        const particleTimer = setTimeout(() => setShowParticles(true), 500);
        
        return () => {
          clearTimeout(winLineTimer);
          clearTimeout(particleTimer);
        };
      } else {
        const particleTimer = setTimeout(() => setShowParticles(true), 300);
        return () => clearTimeout(particleTimer);
      }
    } else if (!winner && previousWinner) {
      setShowWinLine(false);
      setShowParticles(false);
      setPreviousWinner(null);
    }
  }, [winner, previousWinner]);

  const playerColorsMap: { [key in PlayerSymbol]?: Color } = {
    [PlayerSymbol.X]: players.X.color,
    [PlayerSymbol.O]: players.O.color,
  };

  const getRemovalSymbol = (index: number): PlayerSymbol | null => {
    if (nextToRemove.X === index) return PlayerSymbol.X;
    if (nextToRemove.O === index) return PlayerSymbol.O;
    return null;
  };

  const isGameActive = !winner;

  if (!isGameActive && (winner === PlayerSymbol.O || winner === PlayerSymbol.X))
    gameState.gameStatus = GameStatus.COMPLETED;

  const isOnlineGame = gameMode === GameModes.ONLINE;
  const isLocalGame = gameMode === GameModes.VS_COMPUTER || gameMode === GameModes.VS_FRIEND;

  const isWinningCell = useCallback(
    (index: number): boolean => {
      if (!winningCombination || !winner || winner === "draw") return false;
      return winningCombination.includes(index as 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8);
    },
    [winningCombination, winner]
  );

  return (
    <div className="w-full" style={{ maxWidth: "100%" }}>
      <Card className="shadow-2xl border-2 rounded-2xl overflow-hidden backdrop-blur-md bg-card/80 w-full">
        <CardContent className="p-4 md:p-6">
          <div
            ref={boardRef}
            className="grid grid-cols-3 gap-3 md:gap-4 aspect-square w-full relative"
            role="grid"
            aria-label="Tic Tac Toe game board"
          >
            {board.map((cellValue, index) => {
              const isCellNextToRemove =
                nextToRemove.X === index || nextToRemove.O === index;
              const symbolToRemove = getRemovalSymbol(index);
              const isCellDisabled = !!winner;

              return (
                <BoardCell
                  key={index}
                  index={index}
                  value={cellValue}
                  playerColors={playerColorsMap}
                  currentPlayer={isGameActive ? currentPlayer : undefined}
                  isNextToRemove={isCellNextToRemove}
                  removalSymbol={symbolToRemove}
                  isDisabled={isCellDisabled}
                  isWinningCell={isWinningCell(index)}
                  onClick={handleCellClick}
                  isNewMove={newMoveIndex === index}
                />
              );
            })}

            <WinLine
              winningCombination={winningCombination}
              boardRef={boardRef}
              isVisible={showWinLine}
            />

            <ParticleEffects
              isActive={showParticles}
              originX={0.5}
              originY={0.5}
              particleCount={winner === "draw" ? 30 : 60}
            />
          </div>
        </CardContent>

        {isGameOver && (
          <CardFooter className="flex justify-center py-3 md:py-4 border-t bg-muted/20">
            <GameButtons
              isOnlineGame={isOnlineGame}
              isLocalGame={isLocalGame}
              isGameOver={isGameOver}
              rematchOffered={rematchOffered}
              rematchRequested={rematchRequested}
              onAcceptRematch={onAcceptRematch}
              onDeclineRematch={onDeclineRematch}
              onLeaveRoom={onLeaveRoom}
              onRequestRematch={onRequestRematch}
              resetGame={resetGame}
              exitGame={exitGame}
            />
          </CardFooter>
        )}
      </Card>
    </div>
  );
};

export default GameBoard;