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
import { User, Users, Play } from "lucide-react";
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
    <T extends unknown>(setter: (value: T) => void) => {
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
    <form onSubmit={handleSubmit} className="w-full max-w-md">
      <Card className="shadow-xl border-2 overflow-hidden">
        <div className="bg-gradient-to-r from-primary to-primary/80 h-2" />
        <CardHeader className="text-center pb-2">
          <CardTitle className="text-2xl font-bold">Tic Tac Toe</CardTitle>
          <CardDescription>
            Choose your settings and start playing
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 pt-4">
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
            <div className="space-y-3 pt-2">
              <label className="text-sm font-medium text-foreground">
                AI Difficulty
              </label>
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
        <CardFooter className="pb-6">
          <Button
            type="submit"
            size="lg"
            className="w-full gap-2 text-lg"
            disabled={!validationResult.isValid}
          >
            <Play className="h-5 w-5" />
            Start Game
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
};

export default LoginForm;
