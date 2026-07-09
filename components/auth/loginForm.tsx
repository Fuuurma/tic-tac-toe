import React, { useCallback, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AI_Difficulty,
  Color,
  GameModes,
  PLAYER_CONFIG,
  PlayerSymbol,
} from "@/app/game/constants/constants";
import { User, Users, Play, Shuffle, LogIn, LogOut, KeyRound } from "lucide-react";
import { ErrorMessage } from "../common/errorMessage";
import { AccountStatus } from "./accountStatus";
import { PlayerInputSection } from "./playerInput";
import { GameModeSelector } from "../game/gameModeSelector";
import { ValidateUserInput } from "@/app/game/auth/validateInput";
import AI_DifficultySelector from "./aiDifficultySelector";
import type { GameIdentity } from "@/app/types/types";
import type { GoogleOAuthReadiness } from "@/app/utils/auth/authConfig";
import { cn } from "@/lib/utils";

type AuthMode = "guest" | "signin";

interface LoginFormProps {
  username: string;
  setUsername: (username: string) => void;
  gameMode: GameModes;
  setGameMode: (gameMode: GameModes) => void;
  selectedColor: Color;
  setSelectedColor: (color: Color) => void;
  opponentName: string;
  setOpponentName: (name: string) => void;
  opponentColor: Color;
  setOpponentColor: (color: Color) => void;
  aiDifficulty: AI_Difficulty;
  setAiDifficulty: (difficulty: AI_Difficulty) => void;
  identityKind: GameIdentity["kind"];
  durableProfileEnabled: boolean;
  googleOAuthReadiness: GoogleOAuthReadiness;
  hasAccount: boolean;
  handleLogin: () => void;
  handleGuestPlay: () => void;
  handleGoogleSignIn: () => void;
  handleSignOut: () => void;
}

export const LoginForm: React.FC<LoginFormProps> = ({
  username,
  setUsername,
  gameMode,
  setGameMode,
  selectedColor,
  setSelectedColor,
  opponentName,
  setOpponentName,
  opponentColor,
  setOpponentColor,
  aiDifficulty,
  setAiDifficulty,
  identityKind,
  durableProfileEnabled,
  googleOAuthReadiness,
  hasAccount,
  handleLogin,
  handleGuestPlay,
  handleGoogleSignIn,
  handleSignOut,
}) => {
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<AuthMode>("guest");

  const validationResult = useMemo(() => {
    return ValidateUserInput(
      username.trim().toLowerCase(),
      opponentName.trim().toLowerCase(),
      gameMode,
      selectedColor,
      opponentColor,
    );
  }, [username, opponentName, gameMode, selectedColor, opponentColor]);

  const handleInputChange = useCallback(
    <T,>(setter: (value: T) => void) => {
      return (value: T) => {
        setError(null);
        setter(value);
      };
    },
    [],
  );

  const focusTab = useCallback((next: AuthMode) => {
    const el = document.getElementById(
      next === "guest" ? "auth-tab-guest" : "auth-tab-signin",
    );
    el?.focus();
    setMode(next);
  }, []);

  const handleTabKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLButtonElement>) => {
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        focusTab("signin");
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        focusTab("guest");
      } else if (e.key === "Home") {
        e.preventDefault();
        focusTab("guest");
      } else if (e.key === "End") {
        e.preventDefault();
        focusTab("signin");
      }
    },
    [focusTab],
  );

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (mode !== "guest") return;
    if (validationResult.isValid) {
      setError(null);
      handleLogin();
    } else {
      setError(validationResult.message);
    }
  };

  const googleReady = googleOAuthReadiness === "ready";

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-[27rem]">
      <Card className="gap-0 overflow-hidden border-2 bg-card/90 py-0 shadow-2xl backdrop-blur-md">
        <div className="h-1 bg-gradient-to-r from-blue-500 via-emerald-500 to-amber-500" />
        <CardHeader className="px-4 pb-2 pt-4 text-center sm:px-6 sm:pb-3 sm:pt-5">
          <div className="mx-auto mb-2 grid h-10 w-10 grid-cols-3 gap-1 rounded-xl border bg-background/80 p-1 shadow-inner sm:mb-3 sm:h-12 sm:w-12">
            {["X", "", "O", "", "X", "", "O", "", "X"].map((mark, index) => (
              <span
                key={`${mark}-${index}`}
                className="flex items-center justify-center rounded bg-muted/80 text-[10px] font-black text-muted-foreground"
                aria-hidden="true"
              >
                {mark}
              </span>
            ))}
          </div>
          <CardTitle className="text-2xl font-black tracking-normal">
            Tic Tac Toe
          </CardTitle>
          <CardDescription className="text-xs leading-tight">
            Pick a mode, choose your color, and jump in.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2.5 px-4 pb-3 pt-0 sm:space-y-3 sm:px-6">
          <ErrorMessage message={error} />

          <AccountStatus
            displayName={username}
            identityKind={identityKind}
            durableProfileEnabled={durableProfileEnabled}
            className="hidden sm:flex"
          />

          <div
            role="tablist"
            aria-label="Sign-in method"
            className="grid grid-cols-2 gap-1 rounded-lg border bg-muted/40 p-1"
          >
            <button
              type="button"
              id="auth-tab-guest"
              role="tab"
              aria-selected={mode === "guest"}
              aria-controls="auth-panel-guest"
              tabIndex={mode === "guest" ? 0 : -1}
              onClick={() => setMode("guest")}
              onKeyDown={handleTabKeyDown}
              className={cn(
                "flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-semibold transition sm:text-sm",
                mode === "guest"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <KeyRound className="h-3.5 w-3.5" />
              Guest
            </button>
            <button
              type="button"
              id="auth-tab-signin"
              role="tab"
              aria-selected={mode === "signin"}
              aria-controls="auth-panel-signin"
              tabIndex={mode === "signin" ? 0 : -1}
              onClick={() => setMode("signin")}
              onKeyDown={handleTabKeyDown}
              className={cn(
                "flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-semibold transition sm:text-sm",
                mode === "signin"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <LogIn className="h-3.5 w-3.5" />
              Sign in
            </button>
          </div>

          <div
            role="tabpanel"
            id="auth-panel-guest"
            aria-labelledby="auth-tab-guest"
            hidden={mode !== "guest"}
            className="space-y-2.5 sm:space-y-3"
          >
            <PlayerInputSection
              idPrefix="player1"
              title="You"
              Icon={User}
              usernameLabel="Your name"
              usernamePlaceholder={PLAYER_CONFIG[PlayerSymbol.X].label}
              usernameValue={username}
              onUsernameChange={handleInputChange(setUsername)}
              colorLabel="Your color"
              selectedColor={selectedColor}
              onColorChange={handleInputChange(setSelectedColor)}
            />

            <GameModeSelector
              selectedMode={gameMode}
              onModeChange={handleInputChange(setGameMode)}
            />

            {gameMode === GameModes.VS_COMPUTER && (
              <AI_DifficultySelector
                selectedDifficulty={aiDifficulty}
                onDifficultyChange={handleInputChange(setAiDifficulty)}
              />
            )}

            {gameMode === GameModes.VS_FRIEND && (
              <PlayerInputSection
                idPrefix="opponent"
                title="Opponent"
                Icon={Users}
                usernameLabel="Opponent's name"
                usernamePlaceholder={PLAYER_CONFIG[PlayerSymbol.O].label}
                usernameValue={opponentName}
                onUsernameChange={handleInputChange(setOpponentName)}
                colorLabel="Opponent's color"
                selectedColor={opponentColor}
                onColorChange={handleInputChange(setOpponentColor)}
                disabledColor={selectedColor}
              />
            )}

            <div className="flex flex-col gap-2 pt-1">
              <Button
                type="submit"
                size="lg"
                disabled={!validationResult.isValid}
                className={cn(
                  "h-11 w-full rounded-lg text-base font-bold sm:h-12",
                  "flex items-center justify-center gap-2 transition-all duration-200 ease-in-out",
                  validationResult.isValid
                    ? "bg-primary shadow-lg hover:bg-primary/90 hover:shadow-xl"
                    : "cursor-not-allowed opacity-50",
                )}
              >
                <Play className="h-5 w-5" />
                {validationResult.isValid ? "Start Game" : "Fill in your name"}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleGuestPlay}
                className="flex h-9 w-full items-center justify-center gap-2 text-xs font-medium opacity-85 hover:opacity-100 md:text-sm"
              >
                <Shuffle className="h-4 w-4" />
                Play as Guest
              </Button>
            </div>
          </div>

          <div
            role="tabpanel"
            id="auth-panel-signin"
            aria-labelledby="auth-tab-signin"
            hidden={mode !== "signin"}
            className="space-y-3"
          >
            {!hasAccount ? (
              <div className="rounded-lg border bg-background/50 p-4 text-center">
                {googleReady ? (
                  <div className="space-y-3">
                    <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <LogIn className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">
                        Sign in to sync your stats
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Your guest stats will be claimed and merged into your
                        account.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="default"
                      size="lg"
                      onClick={handleGoogleSignIn}
                      className="h-11 w-full rounded-lg text-sm font-bold"
                    >
                      <GoogleMark className="mr-2 h-4 w-4" />
                      Continue with Google
                    </Button>
                    <button
                      type="button"
                      onClick={() => setMode("guest")}
                      className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                    >
                      Use Guest instead
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
                      <LogIn className="h-5 w-5" />
                    </div>
                    <p className="text-sm font-semibold">Sign-in unavailable</p>
                    <p className="text-xs text-muted-foreground">
                      {googleOAuthReadiness === "needs-convex"
                        ? "Google sign-in needs Convex configuration (set NEXT_PUBLIC_CONVEX_URL and NEXT_PUBLIC_GOOGLE_OAUTH_ENABLED)."
                        : "Google sign-in is disabled. Use the Guest tab to play."}
                    </p>
                    <button
                      type="button"
                      onClick={() => setMode("guest")}
                      className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                    >
                      Use Guest instead
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-lg border bg-background/50 p-4 text-center">
                <div className="space-y-3">
                  <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    <LogIn className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">Signed in</p>
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      Playing as {username}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="lg"
                    onClick={handleLogin}
                    className="h-11 w-full rounded-lg text-base font-bold"
                  >
                    <Play className="mr-2 h-5 w-5" />
                    Start Game
                  </Button>
                  <div className="flex justify-center gap-3 text-xs">
                    <button
                      type="button"
                      onClick={() => setMode("guest")}
                      className="text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                    >
                      Use Guest instead
                    </button>
                    <span className="text-muted-foreground/50">·</span>
                    <button
                      type="button"
                      onClick={handleSignOut}
                      className="inline-flex items-center gap-1 text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                    >
                      <LogOut className="h-3 w-3" />
                      Sign out
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </form>
  );
};

function GoogleMark({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 48 48"
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.4 29.2 35.5 24 35.5c-6.4 0-11.5-5.1-11.5-11.5S17.6 12.5 24 12.5c3 0 5.7 1.1 7.8 3l5.7-5.7C33.9 6.5 29.2 4.5 24 4.5 12.9 4.5 4 13.4 4 24.5S12.9 44.5 24 44.5c11 0 19.5-8 19.5-20 0-1.4-.1-2.7-.4-4z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 15.7 19 12.5 24 12.5c3 0 5.7 1.1 7.8 3l5.7-5.7C33.9 6.5 29.2 4.5 24 4.5 16.4 4.5 9.8 8.7 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44.5c5.1 0 9.7-1.9 13.2-5l-6.1-5.2C29.3 35.8 26.8 36.5 24 36.5c-5.2 0-9.7-3.2-11.3-7.7l-6.5 5C9.5 40 16.2 44.5 24 44.5z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.2-4.1 5.5l6.1 5.2C41.4 35.6 44 30.5 44 24.5c0-1.4-.1-2.7-.4-4z"
      />
    </svg>
  );
}

export default LoginForm;
