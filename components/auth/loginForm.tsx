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
import { RadioGroup, RadioGroupItem } from "../ui/radio-group";
import { GameMode } from "@/app/types/types";

const LoginForm = ({
  username,
  setUsername,
  gameMode,
  setGameMode,
  handleLogin,
}: any) => {
  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Welcome to Tic Tac Toe</CardTitle>
        <CardDescription>
          Enter your username and select game mode to start playing
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Label htmlFor="username">Username</Label>
        <input
          id="username"
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Enter your username"
          className="w-full p-2 border rounded-md"
        />
        <RadioGroup
          defaultValue="human"
          onValueChange={(value) => setGameMode(value as GameMode)}
        >
          <RadioGroupItem value="human" id="human" />
          <Label htmlFor="human">Play against another player</Label>
          <RadioGroupItem value="computer" id="computer" />
          <Label htmlFor="computer">Play against computer</Label>
        </RadioGroup>
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
