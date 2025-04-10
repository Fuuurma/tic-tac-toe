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
import { User, Users } from "lucide-react";
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
  const [error, setError] = useState<string | null>(null); // Use null for no error

  // Memoize validation logic - recalculates only when dependencies change
  const validationResult = useMemo(() => {
    return VallidateUserInput(
      username.trim().toLowerCase(),
      opponentName.trim().toLowerCase(),
      gameMode,
      selectedColor,
      opponentColor
    );
  }, [username, opponentName, gameMode, selectedColor, opponentColor]);

  // Clear error when relevant fields change - useCallback prevents recreation
  const handleInputChange = useCallback(
    <T extends unknown>(setter: (value: T) => void) => {
      return (value: T) => {
        setError(null); // Clear error on any input change
        setter(value);
      };
    },
    [] // No dependencies needed as setters are stable refs (usually)
  );

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); // Prevent default form submission
    if (validationResult.isValid) {
      setError(null); // Clear any previous error just in case
      handleLogin(); // Call the parent handler to proceed
    } else {
      setError(validationResult.message); // Set the specific error message
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <Card className="w-full mx-auto md:max-w-xl">
        <CardHeader>
          <CardTitle className="text-2xl">Welcome to Tic Tac Toe</CardTitle>
          <CardDescription>
            Enter your details and select game mode to start playing
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <ErrorMessage message={error} />

          <PlayerInputSection
            idPrefix="player1"
            title="Your Details"
            Icon={User}
            usernameLabel="Username"
            usernamePlaceholder={PLAYER_CONFIG[PlayerSymbol.X].label}
            usernameValue={username}
            onUsernameChange={handleInputChange(setUsername)}
            colorLabel="Choose your color"
            selectedColor={selectedColor}
            onColorChange={handleInputChange(setSelectedColor)}
          />

          <GameModeSelector
            selectedMode={gameMode}
            onModeChange={handleInputChange(setGameMode)}
          />

          {gameMode === GameModes.VS_COMPUTER && (
            <div className="pt-4 border-t">
              <AI_DifficultySelector
                selectedDifficulty={aiDifficulty}
                onDifficultyChange={handleInputChange(setAiDifficulty)}
              />
            </div>
          )}

          {gameMode === GameModes.VS_FRIEND && (
            <div className="pt-4 border-t">
              <PlayerInputSection
                idPrefix="opponent"
                title="Opponent Details"
                Icon={Users}
                usernameLabel="Opponent's Username"
                usernamePlaceholder={PLAYER_CONFIG[PlayerSymbol.O].label}
                usernameValue={opponentName}
                onUsernameChange={handleInputChange(setOpponentName)}
                colorLabel="Opponent's color"
                selectedColor={opponentColor}
                onColorChange={handleInputChange(setOpponentColor)}
                disabledColor={selectedColor}
              />
            </div>
          )}
        </CardContent>
        <CardFooter>
          <Button
            type="submit"
            className="w-full"
            disabled={!validationResult.isValid}
          >
            Start Game
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
};

export default LoginForm;
