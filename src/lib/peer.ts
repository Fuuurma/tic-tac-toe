import Peer, { type DataConnection } from "peerjs";
import { Color, PlayerSymbol } from "@/game/constants";
import type { GameState } from "@/game/logic";

export type PeerMessage =
  | { type: "join"; displayName: string; guestId: string; preferredColor?: Color }
  | { type: "joined"; symbol: PlayerSymbol; color: Color; gameState: GameState }
  | { type: "gameStart"; gameState: GameState }
  | { type: "gameUpdate"; gameState: GameState }
  | { type: "move"; index: number }
  | { type: "rematchRequested"; requesterSymbol: PlayerSymbol }
  | { type: "rematchAccept" }
  | { type: "rematchDecline" }
  | { type: "leave" }
  | { type: "error"; message: string };

export const PEERJS_KEY = import.meta.env.VITE_PEERJS_KEY as string | undefined;

export const generateRoomId = (): string => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID().slice(0, 8);
  }
  return Math.random().toString(36).slice(2, 10);
};

export const createHostPeer = (roomId: string): Peer =>
  new Peer(roomId, PEERJS_KEY ? { key: PEERJS_KEY } : undefined);

export const createGuestPeer = (): Peer =>
  new Peer("", PEERJS_KEY ? { key: PEERJS_KEY } : undefined);

export const sendMessage = (conn: DataConnection, message: PeerMessage): void => {
  if (conn.open) conn.send(message);
};
