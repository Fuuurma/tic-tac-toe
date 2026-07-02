"use client";

import { useCallback, useState, useEffect } from "react";
import {
  AI_Difficulty,
  CanMakeMove,
  Color,
  createFreshGameState,
  createInitialGameState,
  GameMode,
  GameModes,
  GameState,
  GameStatus,
  initialGameState,
  PLAYER_CONFIG,
  PlayerSymbol,
} from "@/src/game/core";

import LoginForm from "@/components/auth/loginForm";
import GameBoard from "@/components/game/board";
import PageFooter from "@/components/common/pageFooter";
import { AppSidebar } from "@/components/navbar/sidebar";
import { SidebarInset } from "@/components/ui/sidebar";
import PlayersPanel from "@/components/game/playersPanel";

// Custom Hooks
import { useGameStats } from "./hooks/game/useGameStats";
import { useGameTimer } from "./hooks/game/useGameTimer";
import { useLocalGame } from "./hooks/game/useLocalGame";
import { resolveOpponentColor } from "./utils/colors/resolveOpponentColor";
import { useSocketGame } from "./hooks/game/useSocketGame";
import { GuestProfileSync } from "@/components/convex/guestProfileSync";
import { MatchResultRecorder } from "@/components/convex/matchResultRecorder";
import { isConvexConfigured } from "./utils/convex/config";
import {
  getOrCreateGuestIdentity,
  identityForSocketLogin,
  saveDisplayName,
} from "./utils/identity/gameIdentity";

export default function Home() {
  const [gameState, setGameState] = useState<GameState>(initialGameState);
  const [username, setUsername] = useState<string>("");
  const [opponentName, setOpponentName] = useState<string>("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const identity = getOrCreateGuestIdentity();
      setUsername(identity.displayName);
    }
  }, []);

  const [aiDifficulty, setAI_Difficulty] = useState<AI_Difficulty>(AI_Difficulty.EASY);

  const [loggedIn, setLoggedIn] = useState<boolean>(false);
  const [playerSymbol, setPlayerSymbol] = useState<PlayerSymbol | null>(null);
  const [message, setMessage] = useState<string>("");
  const [gameMode, setGameMode] = useState<GameMode>(GameModes.VS_COMPUTER);
  const [selectedColor, setSelectedColor] = useState<Color>(PLAYER_CONFIG[PlayerSymbol.X].defaultColor);
  const [opponentColor, setOpponentColor] = useState<Color>(PLAYER_CONFIG[PlayerSymbol.O].defaultColor);

  const [rematchOffered, setRematchOffered] = useState(false);
  const [rematchRequested, setRematchRequested] = useState(false);

  // ----- STATS HOOK -----
  const { stats, refreshStats } = useGameStats(
    gameState.gameStatus,
    gameState.winner,
    playerSymbol,
    loggedIn
  );

  // ----- EXIT GAME -----
  const exitGame = useCallback(() => {
    setLoggedIn(false);
    setGameState(createFreshGameState());
    setPlayerSymbol(null);
    setMessage("");
    setOpponentName("");
    setRematchOffered(false);
    setRematchRequested(false);
    refreshStats();
  }, [refreshStats]);

  // ----- SOCKET HOOK -----
  const {
    socket,
    initializeSocket,
    handleSocketMove,
    requestRematch,
    acceptRematch,
    declineRematch,
    leaveRoom,
    resetSocketGame
  } = useSocketGame(
    username,
    selectedColor,
    playerSymbol,
    setPlayerSymbol,
    setGameState,
    setOpponentName,
    setOpponentColor,
    setSelectedColor,
    setMessage,
    setLoggedIn,
    setRematchOffered,
    setRematchRequested,
    exitGame
  );

  // ----- LOCAL GAME HOOK -----
  const { handleLocalMove, resetLocalGame } = useLocalGame(
    gameState,
    setGameState,
    gameMode,
    aiDifficulty,
    loggedIn,
    playerSymbol,
    setMessage
  );

  // ----- TIMER HOOK -----
  useGameTimer(gameState, setGameState, gameMode, playerSymbol);

  // ----- EVENT HANDLERS -----
  const handleLogin = useCallback(() => {
    if (!username.trim()) {
      setMessage("Please enter a username.");
      return;
    }

    const identity = saveDisplayName(username);
    const displayName = identity.displayName;
    setUsername(displayName);

    if (gameMode === GameModes.ONLINE) {
      if (!initializeSocket(identityForSocketLogin(identity, selectedColor))) {
        return;
      }
      setLoggedIn(true);
    } else {
      setGameState(
        createInitialGameState(displayName, gameMode, {
          opponentName,
          playerColor: selectedColor,
          opponentColor: resolveOpponentColor(gameMode, selectedColor, opponentColor),
        })
      );
      setPlayerSymbol(PlayerSymbol.X);
      setMessage("");
      if (socket) socket.disconnect();
      setLoggedIn(true);
    }
  }, [username, gameMode, initializeSocket, opponentName, selectedColor, opponentColor, socket]);

  const handleGuestPlay = useCallback(() => {
    const identity = getOrCreateGuestIdentity();
    const displayName = identity.displayName;
    setUsername(displayName);

    if (gameMode === GameModes.ONLINE) {
      setMessage("Connecting to server...");
      if (initializeSocket(identityForSocketLogin(identity, selectedColor))) {
        setLoggedIn(true);
      }
    } else {
      setGameState(
        createInitialGameState(displayName, gameMode, {
          opponentName,
          playerColor: selectedColor,
          opponentColor: resolveOpponentColor(gameMode, selectedColor, opponentColor),
        })
      );
      setPlayerSymbol(PlayerSymbol.X);
      setMessage("");
      if (socket) socket.disconnect();
      setLoggedIn(true);
    }
  }, [gameMode, initializeSocket, opponentName, selectedColor, opponentColor, socket]);

  const handleCellClick = (index: number) => {
    if (!loggedIn) return;
    if (gameMode === GameModes.ONLINE) {
      const effectivePlayerSymbol =
        playerSymbol ??
        (gameState.players.X.username === username
          ? PlayerSymbol.X
          : gameState.players.O.username === username
            ? PlayerSymbol.O
            : null);

      if (effectivePlayerSymbol !== gameState.currentPlayer) {
        setMessage("It's not your turn.");
        return;
      }
      handleSocketMove(index);
    } else {
      handleLocalMove(index);
    }
  };

  const handleReset = () => {
    if (gameMode === GameModes.ONLINE) {
      resetSocketGame();
    } else {
      resetLocalGame(username, opponentName, selectedColor, opponentColor);
    }
  };

  const isGameOver = gameState.gameStatus === GameStatus.COMPLETED;
  const previewPlayer =
    loggedIn &&
    gameState.gameStatus === GameStatus.ACTIVE &&
    !gameState.winner &&
    CanMakeMove(gameMode, gameState.currentPlayer, playerSymbol)
      ? gameState.currentPlayer
      : undefined;

  return (
    <>
      {isConvexConfigured && (
        <>
          <GuestProfileSync displayName={username} />
          <MatchResultRecorder gameState={gameState} />
        </>
      )}
      <AppSidebar gameState={gameState} gameMode={gameMode} isLoggedIn={loggedIn} stats={stats} />
      <SidebarInset className="flex-1 min-h-dvh overflow-hidden">
        <div className="min-h-dvh h-dvh flex flex-col items-center justify-center bg-[image:var(--gradient-light)] dark:bg-[image:var(--gradient-dark-9)] w-full overflow-y-auto md:overflow-hidden">
          {!loggedIn ? (
            <main className="flex h-full w-full max-w-7xl flex-col items-center justify-center gap-3 p-3 sm:gap-4 sm:p-6 lg:p-8">
              <LoginForm
                username={username}
                setUsername={setUsername}
                gameMode={gameMode}
                setGameMode={setGameMode}
                selectedColor={selectedColor}
                setSelectedColor={setSelectedColor}
                opponentName={opponentName}
                setOpponentName={setOpponentName}
                opponentColor={opponentColor}
                setOpponentColor={setOpponentColor}
                aiDifficulty={aiDifficulty}
                setAiDifficulty={setAI_Difficulty}
                handleLogin={handleLogin}
                handleGuestPlay={handleGuestPlay}
              />
              <PageFooter />
            </main>
          ) : (
            <main className="w-full min-h-0 h-full flex flex-col items-center justify-center gap-2 p-2 sm:gap-3 sm:p-3 md:p-6 overflow-y-auto md:overflow-hidden">
              <PlayersPanel gameState={gameState} message={message} onNewGame={handleReset} onExit={exitGame} />
              <div className="w-full flex flex-none items-center justify-center min-h-0 md:flex-1">
                <GameBoard
                  gameState={gameState}
                  handleCellClick={handleCellClick}
                  resetGame={handleReset}
                  exitGame={exitGame}
                  isGameOver={isGameOver}
                  rematchOffered={rematchOffered}
                  rematchRequested={rematchRequested}
                  onRequestRematch={requestRematch}
                  onAcceptRematch={acceptRematch}
                  onDeclineRematch={declineRematch}
                  onLeaveRoom={leaveRoom}
                  winningCombination={gameState.winningCombination}
                  lastMoveIndex={gameState.lastMoveIndex}
                  previewPlayer={previewPlayer}
                />
              </div>
            </main>
          )}
        </div>
      </SidebarInset>
    </>
  );
}
