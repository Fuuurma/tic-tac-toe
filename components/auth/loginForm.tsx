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
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { GameMode } from "@/app/types/types";
import {
  Color,
  COLOR_VARIANTS,
  GAME_MODES,
  GameModes,
  PLAYER_CONFIG,
  PlayerSymbol,
} from "@/app/game/constants/constants";
import capitalizeFirstLetter from "@/app/utils/capitalize";
import { AlertCircle, User, Users } from "lucide-react";
import { Alert, AlertDescription } from "../ui/alert";
import { Input } from "../ui/input";
import { ErrorMessage } from "../common/errorMessage";
import { PlayerInputSection } from "./playerInput";
import { GameModeSelector } from "../game/gameModeSelector";

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
  handleLogin,
}) => {
  const [error, setError] = useState<string | null>(null); // Use null for no error

  // Memoize validation logic - recalculates only when dependencies change
  const validationResult = useMemo(() => {
    const trimmedUsername = username.trim();
    const trimmedOpponentName = opponentName.trim();

    if (!trimmedUsername) {
      return { isValid: false, message: "Please enter your username." };
    }
    if (gameMode === GameModes.VS_FRIEND) {
      if (!trimmedOpponentName) {
        return { isValid: false, message: "Please enter opponent's username." };
      }
      if (trimmedUsername.toLowerCase() === trimmedOpponentName.toLowerCase()) {
        // Case-insensitive comparison might be better UX
        return { isValid: false, message: "Player names must be different." };
      }
      if (selectedColor === opponentColor) {
        return {
          isValid: false,
          message: "Players must choose different colors.",
        };
      }
    }
    return { isValid: true, message: null };
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
    // Use a form element for better accessibility and semantics
    <form onSubmit={handleSubmit}>
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">Welcome to Tic Tac Toe</CardTitle>
          <CardDescription>
            Enter your details and select game mode to start playing
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {" "}
          {/* Increased spacing slightly */}
          <ErrorMessage message={error} />
          <PlayerInputSection
            idPrefix="player1"
            title="Your Details"
            Icon={User}
            usernameLabel="Username"
            usernamePlaceholder={PLAYER_CONFIG[PlayerSymbol.X].label} // Example placeholder
            usernameValue={username}
            onUsernameChange={handleInputChange(setUsername)}
            colorLabel="Choose your color"
            selectedColor={selectedColor}
            onColorChange={handleInputChange(setSelectedColor)}
            // No disabledColor for Player 1
          />
          <GameModeSelector
            selectedMode={gameMode}
            onModeChange={handleInputChange(setGameMode)}
          />
          {gameMode === GameModes.VS_FRIEND && (
            <div className="pt-4 border-t">
              {" "}
              {/* Add top padding and border */}
              <PlayerInputSection
                idPrefix="opponent"
                title="Opponent Details"
                Icon={Users}
                usernameLabel="Opponent's Username"
                usernamePlaceholder={PLAYER_CONFIG[PlayerSymbol.O].label} // Example placeholder
                usernameValue={opponentName}
                onUsernameChange={handleInputChange(setOpponentName)}
                colorLabel="Opponent's color"
                selectedColor={opponentColor}
                onColorChange={handleInputChange(setOpponentColor)}
                disabledColor={selectedColor} // Disable Player 1's chosen color
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
