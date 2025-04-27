import { GameState, GameMode } from "@/app/types/types";

import {
  PlayerSymbol,
  AI_Difficulty,
  GameStatus,
  GameModes,
  Color,
  Events,
} from "@/app/game/constants/constants";

interface UseGameSocketProps {
  username: string;
  selectedColor: Color;
  onMessage: (msg: string) => void;
  onGameStateUpdate: (state: GameState) => void;
  onPlayerSymbolAssigned: (symbol: PlayerSymbol | null) => void;
  onOpponentUpdate: (name: string, color?: Color) => void;
  onRematchState: (offered: boolean, requested: boolean) => void;
}

interface ClientToServerEvents {
  login: (username: string, color: Color) => void;
  move: (index: number) => void;
  reset: () => void;
  [Events.REQUEST_REMATCH]: () => void;
  [Events.ACCEPT_REMATCH]: () => void;
  [Events.DECLINE_REMATCH]: () => void;
  [Events.LEAVE_ROOM]: () => void;
}
