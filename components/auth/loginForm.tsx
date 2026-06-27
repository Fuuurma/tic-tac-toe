import React, { useCallback, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
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
import { User, Users, Play, Shuffle } from "lucide-react";
import { ErrorMessage } from "../common/errorMessage";
import { PlayerInputSection } from "./playerInput";
import { GameModeSelector } from "../game/gameModeSelector";
import { VallidateUserInput } from "@/app/game/auth/validateInput";
import AI_DifficultySelector from "./aiDifficultySelector";

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
  handleLogin: () => void;
  handleGuestPlay: () => void;
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
  handleLogin,
  handleGuestPlay,
}) => {
  const [error, setError] = useState<string | null>(null);

  const validationResult = useMemo(() => {
    return VallidateUserInput(
      username.trim().toLowerCase(),
      opponentName.trim().toLowerCase(),
      gameMode,
      selectedColor,
      opponentColor
    );
  }, [username, opponentName, gameMode, selectedColor, opponentColor]);

  const handleInputChange = useCallback(
    <T,>(setter: (value: T) => void) => {
      return (value: T) => {
        setError(null);
        setter(value);
      };
    },
    []
  );

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (validationResult.isValid) {
      setError(null);
      handleLogin();
    } else {
      setError(validationResult.message);
    }
  };

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
            <div className="space-y-2">
              <AI_DifficultySelector
                selectedDifficulty={aiDifficulty}
                onDifficultyChange={handleInputChange(setAiDifficulty)}
              />
            </div>
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
        </CardContent>
        <CardFooter className="flex flex-col gap-2 px-4 pb-3 pt-0 sm:px-6 sm:pb-4">
          <Button
            type="submit"
            size="lg"
            className={`
              h-11 w-full rounded-lg text-base font-bold sm:h-12
              transition-all duration-200 ease-in-out
              flex items-center justify-center gap-2
              ${validationResult.isValid 
                ? 'bg-primary hover:bg-primary/90 shadow-lg hover:shadow-xl' 
                : 'opacity-50 cursor-not-allowed'
              }
            `}
            disabled={!validationResult.isValid}
          >
            <Play className="h-5 w-5" />
            {validationResult.isValid ? 'Start Game' : 'Fill in your name'}
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
        </CardFooter>
      </Card>
    </form>
  );
};

export default LoginForm;
