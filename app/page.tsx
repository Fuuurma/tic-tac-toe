"use client";

import { useCallback, useState, useEffect } from "react";
import {
  GameMode,
  GameState,
  initialGameState,
} from "./types/types";

import LoginForm from "@/components/auth/loginForm";
import GameBoard from "@/components/game/board";
import {
  AI_Difficulty,
  Color,
  GameModes,
  GameStatus,
  PLAYER_CONFIG,
  PlayerSymbol,
} from "./game/constants/constants";
import { createFreshGameState } from "./game/logic/newGameState";
import PageFooter from "@/components/common/pageFooter";
import { createInitialGameState } from "./game/logic/createInitialGameState";
import { AppSidebar } from "@/components/navbar/sidebar";
import { SidebarInset } from "@/components/ui/sidebar";
import PlayersPanel from "@/components/game/playersPanel";

// Custom Hooks
import { useGameStats } from "./hooks/game/useGameStats";
import { useGameTimer } from "./hooks/game/useGameTimer";
import { useLocalGame } from "./hooks/game/useLocalGame";
import { useSocketGame } from "./hooks/game/useSocketGame";

export default function Home() {
  const [gameState, setGameState] = useState<GameState>(initialGameState);
  const [username, setUsername] = useState<string>("");
  const [opponentName, setOpponentName] = useState<string>("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("tictactoe_username");
      if (saved) setUsername(saved);
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

    localStorage.setItem("tictactoe_username", username.trim());

    if (gameMode === GameModes.ONLINE) {
      initializeSocket();
    } else {
      setGameState(
        createInitialGameState(username, gameMode, {
          opponentName,
          playerColor: selectedColor,
          opponentColor,
        })
      );
      setPlayerSymbol(PlayerSymbol.X);
      setMessage("");
      if (socket) socket.disconnect();
    }
    setLoggedIn(true);
  }, [username, gameMode, initializeSocket, opponentName, selectedColor, opponentColor, socket]);

  const handleGuestPlay = useCallback(() => {
    const guestName = `Guest-${Math.floor(Math.random() * 9000) + 1000}`;
    setUsername(guestName);
    localStorage.setItem("tictactoe_username", guestName);

    if (gameMode === GameModes.ONLINE) {
      setMessage("Connecting to server...");
      // initializeSocket reads usernameRef.current internally, which will be updated
      // on next render. For the guard check, pass guestName directly.
      // We setLoggedIn after socket init since it's async.
      initializeSocket();
      setLoggedIn(true);
    } else {
      setGameState(
        createInitialGameState(guestName, gameMode, {
          opponentName,
          playerColor: selectedColor,
          opponentColor,
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

  return (
    <>
      <AppSidebar gameState={gameState} gameMode={gameMode} isLoggedIn={loggedIn} stats={stats} />
      <SidebarInset className="flex-1 h-full overflow-hidden">
        <div className="h-full flex flex-col items-center justify-center bg-[image:var(--gradient-light)] dark:bg-[image:var(--gradient-dark-9)] w-full overflow-y-auto md:overflow-hidden">
          {!loggedIn ? (
            <main className="w-full max-w-7xl h-full flex flex-col items-center justify-center gap-4 sm:gap-8 p-4 sm:p-6 lg:p-8">
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
            <main className="w-full h-full flex flex-col items-center justify-start md:justify-center gap-1 sm:gap-1.5 md:gap-3 p-1 sm:p-2 md:p-6 overflow-y-auto md:overflow-hidden">
              <PlayersPanel gameState={gameState} message={message} onNewGame={handleReset} onExit={exitGame} />
              <div className="flex-1 w-full flex items-center justify-center min-h-0">
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
                />
              </div>
            </main>
          )}
        </div>
      </SidebarInset>
    </>
  );
}
