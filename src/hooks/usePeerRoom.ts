import { useCallback, useEffect, useRef, useState } from "react";
import {
  AVAILABLE_COLORS,
  Color,
  GAME_ID,
  GameModes,
  GameStatus,
  PLAYER_CONFIG,
  PlayerSymbol,
  PlayerTypes,
  SymbolShape,
  TURN_DURATION_MS,
} from "@/game/constants";
import {
  createInitialGameState,
  freshGameState,
  isGameActive,
  makeMove,
  makeRandomMove,
} from "@/game/logic";
import type { GameState } from "@/game/logic";
import {
  applyAuthorizedMove,
  applyOptimisticMove,
  generateRoomId,
  isPeerMessage,
} from "@/lib/peer";
import type { PeerMessage } from "@/lib/peer";
import { getOrCreateGuestIdentity, sanitizeDisplayName } from "@/lib/identity";
import {
  buildRoomWsUrl,
  findMatch,
  leaveMatch,
  pollMatch,
  type MatchmakingResponse,
} from "@/lib/matchmaking";
import { RoomClient } from "@/lib/room";

/**
 * Online play hook for tic-tac-toe.
 *
 * Transport: Cloudflare Durable Object WebSocket relay inside the shared
 * `fuurma-matchmaking` Worker. The hook preserves the same public API so the
 * consuming surface (`OnlineGameSurface`) doesn't need to branch.
 *
 * Spec: hub/migrations/2026-07-games-do-websocket-migration.md
 */

export type PeerRole = "host" | "guest" | null;

export type PeerStatus =
  | "idle"
  | "creating"
  | "waiting"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "disconnected"
  | "error";

export interface PeerRoomState {
  role: PeerRole;
  status: PeerStatus;
  roomId: string;
  guestDisplayName: string;
  hostSymbol: PlayerSymbol | null;
  guestSymbol: PlayerSymbol | null;
  message: string;
  gameState: GameState;
}

/**
 * Pending host-side settings that the user changed via the in-game edit
 * button. Stored on the host only; the guest cannot edit a peer's identity.
 */
export interface PendingPlayerSettings {
  displayName: string;
  color: Color;
  playerShape: SymbolShape;
}

const initialState: PeerRoomState = {
  role: null,
  status: "idle",
  roomId: "",
  guestDisplayName: "",
  hostSymbol: null,
  guestSymbol: null,
  message: "",
  gameState: freshGameState(),
};

const sanitizeColor = (color: string | undefined): Color => {
  if (!color) return Color.BLUE;
  return (Object.values(Color) as string[]).includes(color) ? (color as Color) : Color.BLUE;
};

const chooseGuestColor = (preferred: Color, hostColor: Color): Color =>
  preferred !== hostColor
    ? preferred
    : AVAILABLE_COLORS.find((color) => color !== hostColor) ?? Color.GRAY;

export interface PeerRoomOptions {
  hostDisplayName: string;
  hostColor: Color;
  hostShape?: SymbolShape;
  gameMode: typeof GameModes.ONLINE;
}

export function usePeerRoom(options: PeerRoomOptions) {
  const [state, setState] = useState<PeerRoomState>(initialState);
  const roomRef = useRef<RoomClient | null>(null);
  const stateRef = useRef<GameState>(initialState.gameState);
  const hostSymbolRef = useRef<PlayerSymbol | null>(null);
  const roleRef = useRef<PeerRole>(null);
  const tickRef = useRef<number | null>(null);
  const matchmakingTicketRef = useRef<string | null>(null);
  const hasStartedRef = useRef(false);
  // Host remembers when it has issued a rematch request. A guest `rematchAccept`
  // is only honored while a host request is pending and the game is terminal.
  // Without this gate a hostile or buggy guest can reset the host mid-game.
  const hostRematchPendingRef = useRef(false);
  // Host remembers player settings (name/color/shape) the user edited from
  // the in-game edit button. Those changes only apply on the next rematch so
  // the live game is never mutated while it's in progress.
  const hostPendingSettingsRef = useRef<PendingPlayerSettings | null>(null);
  // Guest remembers the authoritative state right before applying an
  // optimistic move. If the host rejects the move via `{type:"error", message:"Invalid move"}`,
  // we roll back so the UI does not drift from the relay's source of truth.
  const pendingGuestStateRef = useRef<GameState | null>(null);

  useEffect(() => {
    stateRef.current = state.gameState;
    roleRef.current = state.role;
    // Any successful gameUpdate / gameStart / joined authoritative state
    // from the host supersedes the guest's optimistic move, so clear the
    // pending rollback snapshot.
    if (roleRef.current === "guest") {
      pendingGuestStateRef.current = null;
    }
  }, [state.gameState, state.role]);

  const update = useCallback((patch: Partial<PeerRoomState>) => {
    setState((prev) => ({ ...prev, ...patch }));
  }, []);

  const stopTimer = useCallback(() => {
    if (tickRef.current !== null) {
      window.clearInterval(tickRef.current);
      tickRef.current = null;
    }
  }, []);

  const broadcastGameState = useCallback((gameState: GameState) => {
    roomRef.current?.send({ type: "gameUpdate", gameState });
  }, []);

  const commitHostState = useCallback(
    (gameState: GameState) => {
      stateRef.current = gameState;
      setState((prev) => ({ ...prev, gameState }));
      broadcastGameState(gameState);
    },
    [broadcastGameState],
  );

  const startTimer = useCallback(() => {
    stopTimer();
    tickRef.current = window.setInterval(() => {
      const current = stateRef.current;
      if (!isGameActive(current)) {
        stopTimer();
        return;
      }
      const remaining = (current.turnTimeRemaining ?? TURN_DURATION_MS) - 1000;
      if (remaining <= 0) {
        const random = makeRandomMove(current.board);
        if (random === null) return;
        const updated = makeMove(current, random);
        if (!updated) return;
        const gameState = { ...updated, turnTimeRemaining: TURN_DURATION_MS };
        stateRef.current = gameState;
        setState((prev) => ({
          ...prev,
          gameState,
          message: `${current.players[current.currentPlayer].username || "Player"} ran out of time`,
        }));
        broadcastGameState(gameState);
        return;
      }
      const gameState = { ...current, turnTimeRemaining: remaining };
      commitHostState(gameState);
    }, 1000);
  }, [broadcastGameState, commitHostState, stopTimer]);

  const applyHostMove = useCallback(
    (index: number, actor: PlayerSymbol) => {
      const current = stateRef.current;
      const next = applyAuthorizedMove(current, index, actor);
      if (!next) {
        if (actor === PlayerSymbol.O) {
          roomRef.current?.send({ type: "error", message: "Invalid move" });
        }
        return;
      }
      commitHostState({ ...next, turnTimeRemaining: TURN_DURATION_MS });
    },
    [commitHostState],
  );

  const handleHostData = useCallback(
    (message: PeerMessage) => {
      if (message.type === "join") {
        const state = stateRef.current;
        const hostSymbol = hostSymbolRef.current ?? PlayerSymbol.X;
        const guestSymbol = hostSymbol === PlayerSymbol.X ? PlayerSymbol.O : PlayerSymbol.X;
        const guestColor = chooseGuestColor(
          sanitizeColor(message.preferredColor),
          state.players[hostSymbol].color,
        );
        const guestDisplayName = sanitizeDisplayName(message.displayName, "Guest");
        const updated: GameState = {
          ...state,
          gameStatus: GameStatus.ACTIVE,
          players: {
            ...state.players,
            [guestSymbol]: {
              username: guestDisplayName,
              color: guestColor,
              symbol: guestSymbol,
              shape: state.players[guestSymbol].shape,
              type: PlayerTypes.HUMAN,
              isActive: true,
              lastMoveAt: Date.now(),
            },
          },
        };
        stateRef.current = updated;
        roomRef.current?.send({ type: "joined", symbol: guestSymbol, color: guestColor, gameState: updated });
        roomRef.current?.send({ type: "gameStart", gameState: updated });
        setState((prev) => ({
          ...prev,
          status: "connected",
          guestDisplayName,
          guestSymbol,
          gameState: updated,
          message: "",
        }));
        return;
      }
      if (message.type === "move") {
        const hostSymbol = hostSymbolRef.current ?? PlayerSymbol.X;
        const guestSymbol = hostSymbol === PlayerSymbol.X ? PlayerSymbol.O : PlayerSymbol.X;
        applyHostMove(message.index, guestSymbol);
        return;
      }
      if (message.type === "rematchAccept") {
        const state = stateRef.current;
        // Two gates:
        // 1. The host must have issued a rematch request that's still pending.
        //    A stray guest message without a pending request is ignored.
        // 2. The current game must already be terminal — we never reset a
        //    game that's still in progress, even if both sides agree.
        if (
          !hostRematchPendingRef.current ||
          state.winner === null ||
          state.gameStatus !== GameStatus.COMPLETED
        ) {
          return;
        }
        hostRematchPendingRef.current = false;
        const newHostSymbol: PlayerSymbol = Math.random() < 0.5 ? PlayerSymbol.X : PlayerSymbol.O;
        const newGuestSymbol = newHostSymbol === PlayerSymbol.X ? PlayerSymbol.O : PlayerSymbol.X;
        hostSymbolRef.current = newHostSymbol;
        const hostPlayer = state.players[hostSymbolRef.current ?? PlayerSymbol.X];
        const guestPlayer = state.players[newGuestSymbol];
        // If the host edited their identity mid-game via the edit button,
        // pull that into the next match instead of keeping the previous one.
        const pending = hostPendingSettingsRef.current;
        const hostName = pending?.displayName ?? hostPlayer.username;
        const hostColor = pending?.color ?? hostPlayer.color;
        const hostShape = pending?.playerShape ?? hostPlayer.shape;
        if (pending) hostPendingSettingsRef.current = null;
        const reset = createInitialGameState({
          gameMode: GameModes.ONLINE,
          playerXName: newHostSymbol === PlayerSymbol.X ? hostName : guestPlayer.username,
          playerOName: newHostSymbol === PlayerSymbol.O ? hostName : guestPlayer.username,
          playerColor: hostColor,
          opponentColor: guestPlayer.color,
          playerShape: hostShape,
          opponentShape: guestPlayer.shape,
          humanSymbol: newHostSymbol,
        });
        reset.players[newGuestSymbol].isActive = true;
        stateRef.current = reset;
        setState((prev) => ({
          ...prev,
          hostSymbol: newHostSymbol,
          guestSymbol: newGuestSymbol,
          gameState: reset,
          message: "",
        }));
        broadcastGameState(reset);
        roomRef.current?.send({ type: "gameStart", gameState: reset });
        return;
      }
      if (message.type === "rematchDecline") {
        hostRematchPendingRef.current = false;
        setState((prev) => ({ ...prev, message: "Rematch declined" }));
        return;
      }
      if (message.type === "leave") {
        stopTimer();
        hostRematchPendingRef.current = false;
        const state = stateRef.current;
        // Host wins by forfeit when the guest leaves (unless the game
        // already had a winner).
        const ended: GameState = state.winner
          ? state
          : { ...state, winner: PlayerSymbol.X, gameStatus: GameStatus.COMPLETED };
        stateRef.current = ended;
        setState((prev) => ({ ...prev, gameState: ended, message: "Opponent left" }));
        return;
      }
      if (message.type === "error" && message.message === "Invalid move") {
        // The host rejected the guest's most recent optimistic move. Roll
        // back to the last authoritative state we received so the UI and
        // gameState ref do not drift while we wait for the next gameUpdate.
        const previous = pendingGuestStateRef.current;
        if (previous) {
          stateRef.current = previous;
          pendingGuestStateRef.current = null;
          setState((prev) => ({ ...prev, gameState: previous, message: "Move was rejected by host" }));
        }
        return;
      }
    },
    [applyHostMove, broadcastGameState, stopTimer],
  );

  const handleWsEvent = useCallback(
    (event: { type: string; [k: string]: unknown }) => {
      if (event.type === "welcome") {
        const role = (event as { role?: string }).role;
        const opponent = (event as { opponent?: { guestId: string; displayName: string } | null }).opponent ?? null;
        if (role === "host") {
          // Host wakes up (initial or reconnect). If opponent present, they're
          // already back; if not, wait for peer-joined.
          if (opponent) {
            setState((prev) => ({
              ...prev,
              role: "host",
              status: "connected",
              guestDisplayName: opponent.displayName,
              guestSymbol: PlayerSymbol.O,
              message: "",
            }));
          } else {
            setState((prev) => ({
              ...prev,
              role: "host",
              status: prev.status === "connected" ? "connected" : "waiting",
              message: prev.status === "connected" ? "" : `Room ${prev.roomId} — waiting for opponent`,
            }));
          }
        }
        return;
      }
      if (event.type === "peer-reconnected") {
        setState((prev) => ({
          ...prev,
          status: "connected",
          message: "",
        }));
        if (roleRef.current === "host") {
          // After a reconnect grace, the host's local timer may be near zero
          // (the interval kept running) or it may have been paused mid-turn.
          // Reset the wire timer to the full budget and broadcast the new
          // state so the rejoining guest catches up. Without this reset the
          // very next tick can fire a forced random move.
          const current = stateRef.current;
          if (isGameActive(current)) {
            const reconciled = {
              ...current,
              turnTimeRemaining: TURN_DURATION_MS,
            };
            commitHostState(reconciled);
            startTimer();
          } else {
            broadcastGameState(current);
          }
        }
        return;
      }
      if (event.type === "peer-joined") {
        // Host learns a new peer arrived at the relay. The guest will send
        // its real `join` message (with preferred color) immediately after
        // `welcome`, so we only update status here — do NOT synthesize a
        // join, which would build game state with a wrong hardcoded color
        // and then be overwritten by the real join moments later.
        setState((prev) =>
          prev.status === "connected"
            ? prev
            : {
                ...prev,
                status: "connecting",
                message: "Opponent connecting…",
              },
        );
        return;
      }
      if (event.type === "peer-left") {
        const reason = (event as { reason?: string }).reason;
        if (reason === "disconnect") {
          if (roleRef.current === "host") stopTimer();
          setState((prev) => ({
            ...prev,
            status: "reconnecting",
            message: roleRef.current === "guest"
              ? "Host disconnected. Reconnecting…"
              : "Opponent disconnected. Reconnecting…",
          }));
          return;
        }
        if (roleRef.current === "guest") {
          stopTimer();
          hostRematchPendingRef.current = false;
          const current = stateRef.current;
          // Guest wins by forfeit when the host disconnects (unless the
          // game already had a winner).
          const gameState = current.winner
            ? current
            : { ...current, winner: PlayerSymbol.O, gameStatus: GameStatus.COMPLETED };
          stateRef.current = gameState;
          setState((prev) => ({
            ...prev,
            status: "disconnected",
            gameState,
            message: "Host disconnected",
          }));
          return;
        }
        if (roleRef.current === "host") {
          stopTimer();
          hostRematchPendingRef.current = false;
          const current = stateRef.current;
          const gameState = current.winner
            ? current
            : { ...current, winner: PlayerSymbol.X, gameStatus: GameStatus.COMPLETED };
          stateRef.current = gameState;
          setState((prev) => ({
            ...prev,
            status: "disconnected",
            gameState,
            message: "Opponent disconnected",
          }));
          return;
        }
        return;
      }
      if (event.type === "error") {
        setState((prev) => ({
          ...prev,
          message: String((event as { message?: string }).message ?? "Room error"),
        }));
        return;
      }
    },
    [broadcastGameState, commitHostState, startTimer, stopTimer],
  );

  const handleGuestData = useCallback(
    (message: PeerMessage) => {
      if (message.type === "joined" || message.type === "gameStart" || message.type === "gameUpdate") {
        stateRef.current = message.gameState;
        setState((prev) => {
          const localSymbol =
            message.type === "joined" && message.symbol
              ? message.symbol
              : prev.guestSymbol;
          return {
            ...prev,
            status: "connected",
            gameState: message.gameState,
            guestSymbol: localSymbol,
            guestDisplayName:
              localSymbol === PlayerSymbol.O
                ? message.gameState.players[PlayerSymbol.X].username
                : message.gameState.players[PlayerSymbol.O].username,
            message: "",
          };
        });
        return;
      }
      if (message.type === "rematchRequested") {
        const state = stateRef.current;
        setState((prev) => ({
          ...prev,
          message: `${state.players[message.requesterSymbol].username} wants a rematch — click Play Again to accept`,
        }));
        return;
      }
      if (message.type === "leave") {
        // Host explicitly left. The close event will follow, but we can
        // show a more specific message now.
        stopTimer();
        const current = stateRef.current;
        const gameState = current.winner
          ? current
          : { ...current, winner: PlayerSymbol.O, gameStatus: GameStatus.COMPLETED };
        stateRef.current = gameState;
        setState((prev) => ({
          ...prev,
          status: "disconnected",
          gameState,
          message: "Host left the game",
        }));
        return;
      }
      if (message.type === "error") {
        setState((prev) => ({ ...prev, message: message.message }));
        return;
      }
    },
    [stopTimer],
  );

  const buildRoomClient = useCallback((wsUrl: string, role: "host" | "guest"): RoomClient => {
    const identity = getOrCreateGuestIdentity();
    const client = new RoomClient({
      wsUrl,
      game: GAME_ID,
      guestId: identity.guestId,
      displayName: options.hostDisplayName,
      role,
    });
    client.setMessageHandler((msg) => {
      if (msg.type === "welcome" || msg.type === "peer-joined" || msg.type === "peer-reconnected" || msg.type === "peer-left" || msg.type === "error") {
        handleWsEvent(msg as { type: string; [k: string]: unknown });
        if (msg.type === "welcome" && role === "guest") {
          const identity = getOrCreateGuestIdentity();
          client.send({
            type: "join",
            displayName: options.hostDisplayName,
            guestId: identity.guestId,
            preferredColor: options.hostColor,
          });
        }
      } else if (isPeerMessage(msg)) {
        const m = msg as PeerMessage;
        if (stateRef.current && roleRef.current) {
          if (roleRef.current === "host") {
            handleHostData(m);
          } else {
            handleGuestData(m);
          }
        }
      }
    });
    client.setStatusHandler((status, detail) => {
      if (status === "connected" && roleRef.current === null) {
        // initial room connect: status will be set in welcome handler
      } else if (status === "reconnecting") {
        setState((prev) => ({ ...prev, status: "reconnecting", message: detail ?? "Reconnecting..." }));
      } else if (status === "disconnected") {
        setState((prev) => ({ ...prev, status: "disconnected", message: detail ?? "Disconnected" }));
      } else if (status === "error") {
        setState((prev) => ({ ...prev, status: "error", message: detail ?? "Connection error" }));
      }
    });
    roomRef.current = client;
    return client;
  }, [handleGuestData, handleHostData, handleWsEvent, options.hostDisplayName, options.hostColor]);

  const startAsHost = useCallback(
    (providedRoomId?: string, wsUrl?: string) => {
      stopTimer();
      const roomId = providedRoomId ?? generateRoomId();
      const hostSymbol: PlayerSymbol = Math.random() < 0.5 ? PlayerSymbol.X : PlayerSymbol.O;
      const guestSymbol = hostSymbol === PlayerSymbol.X ? PlayerSymbol.O : PlayerSymbol.X;
      hostSymbolRef.current = hostSymbol;
      const waitingGame = createInitialGameState({
        gameMode: GameModes.ONLINE,
        playerXName: sanitizeDisplayName(options.hostDisplayName, "Host"),
        playerOName: "Waiting for opponent",
        playerColor: options.hostColor,
        opponentColor: chooseGuestColor(Color.BLUE, options.hostColor),
        playerShape: options.hostShape ?? PLAYER_CONFIG[hostSymbol].defaultShape,
        humanSymbol: hostSymbol,
      });
      waitingGame.gameStatus = GameStatus.WAITING;
      stateRef.current = waitingGame;
      update({
        role: "host",
        status: "creating",
        roomId,
        guestDisplayName: "",
        hostSymbol,
        guestSymbol,
        gameState: waitingGame,
        message: "",
      });
      roleRef.current = "host";

      const resolvedUrl = wsUrl ?? buildRoomWsUrl(roomId, GAME_ID);
      const room = buildRoomClient(resolvedUrl, "host");
      room.connect().catch((err) => {
        update({ status: "error", message: `Room connect failed: ${(err as Error).message}` });
      });
    },
    [buildRoomClient, options.hostColor, options.hostDisplayName, options.hostShape, stopTimer, update],
  );

  const joinAsGuest = useCallback(
    (roomId: string, wsUrl?: string) => {
      stopTimer();
      const trimmed = roomId.trim();
      if (!trimmed) {
        update({ status: "error", message: "Enter a room ID" });
        return;
      }
      update({ role: "guest", status: "connecting", roomId: trimmed, message: "Connecting..." });
      roleRef.current = "guest";

      const resolvedUrl = wsUrl ?? buildRoomWsUrl(trimmed, GAME_ID);
      const room = buildRoomClient(resolvedUrl, "guest");
      room.connect().catch((err) => {
        update({ status: "error", message: `Room connect failed: ${(err as Error).message}` });
      });
    },
    [buildRoomClient, stopTimer, update],
  );

  const startQuickMatch = useCallback(async () => {
    if (hasStartedRef.current) return;
    hasStartedRef.current = true;
    stopTimer();
    update({ status: "creating", message: "Finding match…" });
    const identity = getOrCreateGuestIdentity();
    const sessionId = crypto.randomUUID();
    try {
      const response: MatchmakingResponse = await findMatch({
        game: GAME_ID,
        peerId: sessionId,
        displayName: options.hostDisplayName,
        guestId: identity.guestId,
      });

      if (response.status === "waiting") {
        matchmakingTicketRef.current = response.ticket;
        const wsUrl = buildRoomWsUrl(response.roomId, GAME_ID);
        startAsHost(response.roomId, wsUrl);

        // Poll the matchmaking service until the guest is paired.
        // Bounded by a max duration and the user's ability to cancel
        // via leave() (which clears the ticket ref).
        const POLL_INTERVAL_MS = 500;
        const MAX_POLL_MS = 120_000;
        const pollStart = Date.now();
        while (Date.now() - pollStart < MAX_POLL_MS) {
          if (!matchmakingTicketRef.current) break; // user cancelled via leave()
          const matched = await pollMatch(GAME_ID, response.ticket);
          if (matched.status === "matched") {
            break;
          }
          await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
        }

        leaveMatch(GAME_ID, response.ticket).catch(() => {});
        matchmakingTicketRef.current = null;
        hasStartedRef.current = false;
        return;
      }

      if (response.status === "matched") {
        matchmakingTicketRef.current = null;
        hasStartedRef.current = false;
        joinAsGuest(response.match.roomId, response.match.wsUrl);
        return;
      }
    } catch (err) {
      matchmakingTicketRef.current = null;
      update({ status: "error", message: `Matchmaking failed: ${(err as Error).message}` });
    }
  }, [joinAsGuest, options.hostDisplayName, startAsHost, stopTimer, update]);

  const sendMove = useCallback(
    (index: number) => {
      if (state.role === "host") {
        applyHostMove(index, PlayerSymbol.X);
        return;
      }
      if (state.role === "guest") {
        const guestSymbol = state.guestSymbol;
        const optimistic = guestSymbol
          ? applyOptimisticMove(stateRef.current, index, guestSymbol)
          : null;
        if (!optimistic) return;

        const sent = roomRef.current?.send({ type: "move", index }) ?? false;
        if (!sent) return;

        // Render the guest's move immediately. The host's gameUpdate remains
        // authoritative and will reconcile this state when it arrives; if the
        // host rejects this move, the rollback path restores the snapshot we
        // save here so the guest does not drift from the relay's truth.
        pendingGuestStateRef.current = stateRef.current;
        stateRef.current = optimistic;
        setState((prev) => ({ ...prev, gameState: optimistic }));
      }
    },
    [applyHostMove, state.guestSymbol, state.role],
  );

  const requestRematch = useCallback(() => {
    if (state.role === "guest") {
      // A guest "rematch" only counts when it follows a host rematch request
      // while the previous game is terminal. Host gating must mirror this.
      if (
        state.status !== "connected" ||
        state.gameState.winner === null ||
        state.gameState.gameStatus !== GameStatus.COMPLETED
      ) {
        return;
      }
      roomRef.current?.send({ type: "rematchAccept" });
    } else if (state.role === "host") {
      // Host can only request a rematch when the previous game is over and
      // the guest is still in the room.
      if (
        state.gameState.winner === null ||
        state.gameState.gameStatus !== GameStatus.COMPLETED
      ) {
        return;
      }
      hostRematchPendingRef.current = true;
      // Use the host's current symbol so the guest UI names the right player.
      const hostSymbol = hostSymbolRef.current ?? PlayerSymbol.X;
      roomRef.current?.send({ type: "rematchRequested", requesterSymbol: hostSymbol });
    }
  }, [state.role, state.gameState.winner, state.gameState.gameStatus, state.status]);

  const declineRematch = useCallback(() => {
    if (state.role === "guest") {
      roomRef.current?.send({ type: "rematchDecline" });
    }
  }, [state.role]);

  const leave = useCallback(() => {
    roomRef.current?.close();
    roomRef.current = null;
    stopTimer();
    const ticket = matchmakingTicketRef.current;
    if (ticket) {
      leaveMatch(GAME_ID, ticket).catch(() => {});
      matchmakingTicketRef.current = null;
    }
    hasStartedRef.current = false;
    setState((prev) => ({ ...prev, status: "disconnected", message: "You left" }));
  }, [stopTimer]);

  useEffect(() => {
    if (state.role === "host" && isGameActive(stateRef.current)) {
      startTimer();
    } else {
      stopTimer();
    }
    return () => stopTimer();
  }, [state.role, state.gameState.gameStatus, state.gameState.winner, startTimer, stopTimer]);

  useEffect(() => () => leave(), [leave]);

  const retryReconnect = useCallback(() => {
    roomRef.current?.reconnectNow();
  }, []);

  const updatePendingSettings = useCallback((next: PendingPlayerSettings) => {
    hostPendingSettingsRef.current = next;
  }, []);

  return {
    state,
    startAsHost,
    startQuickMatch,
    joinAsGuest,
    sendMove,
    requestRematch,
    declineRematch,
    retryReconnect,
    leave,
    updatePendingSettings,
  };
}
