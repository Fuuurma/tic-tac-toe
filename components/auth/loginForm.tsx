import React from "react";
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

interface LoginFormProps {
  username: string;
  setUsername: (username: string) => void;
  gameMode: GameMode;
  setGameMode: (gameMode: GameMode) => void;
  handleLogin: () => void;
}

export const LoginForm: React.FC<LoginFormProps> = ({
  username,
  setUsername,
  gameMode,
  setGameMode,
  handleLogin,
}) => {
  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Welcome to Tic Tac Toe</CardTitle>
        <CardDescription>
          Enter your username and select game mode to start playing
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="username">Username</Label>
          <input
            id="username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Enter your username"
            className="w-full p-2 border rounded-md"
          />
        </div>

        <div className="space-y-2">
          <div className="text-sm font-medium">Game Mode</div>
          <RadioGroup
            defaultValue="human"
            onValueChange={(value) => setGameMode(value as GameMode)}
            className="flex flex-col space-y-2"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="human" id="human" />
              <Label htmlFor="human">Play against another player</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="computer" id="computer" />
              <Label htmlFor="computer">Play against computer</Label>
            </div>
          </RadioGroup>
        </div>
      </CardContent>
      <CardFooter>
        <Button onClick={handleLogin} className="w-full">
          Start Game
        </Button>
      </CardFooter>
    </Card>
  );
};

export default LoginForm;
