import { describe, expect, it, vi } from 'vitest';
import { handleGuestMessage } from '../hooks/peer-room/guestProtocol';
import { handleHostMessage } from '../hooks/peer-room/hostProtocol';
import type { GameState } from '../game/logic';
import { createInitialGameState } from '../game/logic';
import { GameModes, GameStatus } from '../game/constants';

/**
 * Protocol-level regression locks for the guest/host message cores
 * (fleet critic 2026-09-06: both the misplaced rollback branch and the
 * rematch identity swap were invisible without these).
 */

function gameState(overrides: Partial<GameState>): GameState {
  const base = createInitialGameState({
    gameMode: GameModes.ONLINE,
    playerXName: 'Host',
    playerOName: 'Guest',
    playerColor: 'blue' as never,
    opponentColor: 'red' as never,
    humanSymbol: 'X' as never,
  });
  return { ...base, ...overrides } as GameState;
}

describe('guestProtocol.handleGuestMessage — optimistic rollback', () => {
  // The relay RESERVES `error` and answers a client-sent frame back to the
  // sender, so the host could never deliver the rejection this rollback once
  // listened for. The host resyncs with an authoritative update instead; the
  // guest recognises a rejected move by an update whose moveCount still
  // matches its own pre-move snapshot. These pin that replacement contract.
  const guestDeps = (stateRef: { current: GameState }, pendingGuestStateRef: { current: GameState | null }, patches: Array<(prev: never) => { message?: string }>) => ({
    stateRef,
    guestSymbolRef: { current: 'O' as never },
    pendingGuestStateRef,
    rematchPendingRef: { current: false },
    setState: (fn: (prev: never) => never) => patches.push(fn as never),
    stopTimer: () => {},
    clearRematchTimeout: () => {},
  });

  it('rolls back and says so when the host resyncs without counting our move', () => {
    const preMove = gameState({ turnTimeRemaining: 20_000 });
    const pendingGuestStateRef = { current: preMove as GameState | null };
    // Guest optimistically rendered its own mark: moveCount 1 locally.
    const stateRef = { current: gameState({ board: ['X'], moveCount: 1 } as never) };
    const patches: Array<(prev: never) => { message?: string }> = [];
    // The host resyncs at moveCount 0 — our move never landed.
    const authoritative = gameState({});

    handleGuestMessage(guestDeps(stateRef, pendingGuestStateRef, patches) as never, {
      type: 'gameUpdate',
      gameState: authoritative,
    });

    expect(stateRef.current.board).toEqual(authoritative.board);
    expect(pendingGuestStateRef.current).toBeNull();
    expect(patches).toHaveLength(1);
    const next = patches[0]({} as never);
    expect(next.message).toBe('Move was rejected by host');
  });

  it('stays silent when the resync DOES count our move', () => {
    const preMove = gameState({});
    const pendingGuestStateRef = { current: preMove as GameState | null };
    const stateRef = { current: gameState({ moveCount: 1 } as never) };
    const patches: Array<(prev: never) => { message?: string }> = [];
    const authoritative = gameState({ moveCount: 1 } as never);

    handleGuestMessage(guestDeps(stateRef, pendingGuestStateRef, patches) as never, {
      type: 'gameUpdate',
      gameState: authoritative,
    });

    expect(stateRef.current.board).toEqual(authoritative.board);
    expect(pendingGuestStateRef.current).toBeNull();
    expect(patches[0]({} as never).message).toBe('');
  });

  it('treats a relay error as display-only (no rollback, snapshot kept)', () => {
    const stateRef = { current: gameState({}) };
    const pendingGuestStateRef = { current: gameState({}) };
    const patches: Array<(prev: never) => { message?: string }> = [];

    handleGuestMessage(guestDeps(stateRef, pendingGuestStateRef, patches) as never, {
      type: 'error',
      message: 'reserved type: something',
    });

    // No rollback: board state untouched, snapshot kept.
    const before = stateRef.current;
    expect(stateRef.current).toBe(before);
    expect(pendingGuestStateRef.current).not.toBeNull();
    expect(patches[0]({} as never).message).toBe('reserved type: something');
  });
});

// Either side may ask for a rematch, so the guest must honour the same
// one-request-in-flight rule the host does — otherwise a mutual ask leaves
// both sides showing a prompt plus an outgoing cancel, each waiting out the
// 30s expiry on the other.
describe('guestProtocol.handleGuestMessage — rematch mutual-ask gate', () => {
  const state = gameState({
    gameStatus: GameStatus.COMPLETED,
    winner: 'X' as never,
    players: { X: { username: 'Host' }, O: { username: 'Guest' } },
  } as never);

  it('ignores an incoming request while one of ours is still pending', () => {
    const patches: Array<(prev: never) => never> = [];
    const deps = {
      stateRef: { current: state },
      guestSymbolRef: { current: 'O' as never },
      pendingGuestStateRef: { current: null },
      rematchPendingRef: { current: true },
      setState: (fn: (prev: never) => never) => patches.push(fn),
      stopTimer: () => {},
      clearRematchTimeout: () => {},
    };

    handleGuestMessage(deps as never, { type: 'rematchRequested', requesterSymbol: 'X' as never });

    expect(patches).toHaveLength(0);
  });

  it('clears our own pending flag when the host accepts with a gameStart', () => {
    const rematchPendingRef = { current: true };
    const clearRematchTimeout = vi.fn();
    let cleared = 0;
    const deps = {
      stateRef: { current: state },
      guestSymbolRef: { current: 'O' as never },
      pendingGuestStateRef: { current: null },
      rematchPendingRef,
      setState: (fn: (prev: never) => never) => {
        cleared = 1;
        fn({ rematchOutgoing: true } as never);
      },
      stopTimer: () => {},
      clearRematchTimeout,
    };

    handleGuestMessage(deps as never, {
      type: 'gameStart',
      symbol: 'X' as never,
      gameState: gameState({}),
    });

    expect(rematchPendingRef.current).toBe(false);
    expect(clearRematchTimeout).toHaveBeenCalledOnce();
    expect(cleared).toBe(1);
  });
});

describe('hostProtocol.handleHostMessage — rematch identity', () => {
  const completed = (hostName: string, guestName: string) =>
    gameState({
      winner: 'X' as never,
      gameStatus: GameStatus.COMPLETED,
      players: {
        X: { username: hostName, color: 'blue', shape: 'heart' },
        O: { username: guestName, color: 'red', shape: 'star' },
      },
    } as never);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const makeDeps = (state: GameState, currentHostSymbol: 'X' | 'O', sent: unknown[]): any => ({
    stateRef: { current: state },
    roomRef: {
      current: {
        send: (msg: unknown) => {
          sent.push(msg);
          return true;
        },
      },
    },
    hostSymbolRef: { current: currentHostSymbol },
    rematchPendingRef: { current: true },
    lastSyncReplyAtRef: { current: 0 },
    guestJoinedRef: { current: true },
    reconnectResetsRef: { current: { moveCount: -1 } },
    hostPendingSettingsRef: { current: null },
    setState: () => {},
    commitHostState: () => {},
    broadcastGameState: () => {},
    stopTimer: () => {},
    clearRematchTimeout: () => {},
  });

  it('keeps each player their own identity when symbols swap on rematch', () => {
    // Host was X, guest was O. New host symbol = O (a swap).
    const state = completed('Alice', 'Bob');
    const sent: Array<{ type: string; symbol?: string; gameState: GameState }> = [];
    const deps = makeDeps(state, 'X', sent);

    // F478: force the swap so indexing identities by the new symbol fails.
    const random = vi.spyOn(Math, 'random').mockReturnValue(0.75);
    try {
      handleHostMessage(deps as never, { type: 'rematchAccept' });

      const start = sent.find((m) => m.type === 'gameStart');
      expect(deps.hostSymbolRef.current).toBe('O');
      expect(start?.symbol).toBe('X');
      expect(start?.gameState.players.O).toMatchObject({
        username: 'Alice', color: 'blue', shape: 'heart',
      });
      expect(start?.gameState.players.X).toMatchObject({
        username: 'Bob', color: 'red', shape: 'star',
      });
    } finally {
      random.mockRestore();
    }
  });
});

describe('guestProtocol.handleGuestMessage — symbol update on gameStart', () => {
  const gameState = (overrides: Partial<GameState>): GameState => {
    const base = createInitialGameState({
      gameMode: GameModes.ONLINE,
      playerXName: 'Host',
      playerOName: 'Guest',
      playerColor: 'blue' as never,
      opponentColor: 'red' as never,
      humanSymbol: 'X' as never,
    });
    return { ...base, ...overrides } as GameState;
  };

  it('updates guestSymbol when gameStart carries a swapped symbol after rematch', () => {
    // Guest was initially O (from joined). After rematch, host swaps
    // to O, so guest is now X. The gameStart message must carry the
    // new guest symbol.
    const newState = gameState({});
    const guestSymbolRef = { current: 'O' as never };
    let lastState: { guestSymbol?: string } = {};
    const deps = {
      stateRef: { current: newState },
      guestSymbolRef,
      pendingGuestStateRef: { current: null },
      rematchPendingRef: { current: true },
      setState: (fn: (prev: never) => never) => {
        lastState = fn({ guestSymbol: 'O' } as never);
      },
      stopTimer: () => {},
      clearRematchTimeout: () => {},
    };

    // Simulate gameStart after rematch where host swapped to O → guest is X
    handleGuestMessage(deps as never, {
      type: 'gameStart',
      symbol: 'X' as never,
      gameState: newState,
    });

    expect(guestSymbolRef.current).toBe('X');
    expect(lastState.guestSymbol).toBe('X');
  });

  it('preserves guestSymbol when gameStart carries the same symbol', () => {
    const newState = gameState({});
    const guestSymbolRef = { current: 'O' as never };
    let lastState: { guestSymbol?: string } = {};
    const deps = {
      stateRef: { current: newState },
      guestSymbolRef,
      pendingGuestStateRef: { current: null },
      rematchPendingRef: { current: true },
      setState: (fn: (prev: never) => never) => {
        lastState = fn({ guestSymbol: 'O' } as never);
      },
      stopTimer: () => {},
      clearRematchTimeout: () => {},
    };

    handleGuestMessage(deps as never, {
      type: 'gameStart',
      symbol: 'O' as never,
      gameState: newState,
    });

    expect(guestSymbolRef.current).toBe('O');
    expect(lastState.guestSymbol).toBe('O');
  });
});

describe('guestProtocol.handleGuestMessage — rematch prompt gate (F191)', () => {
  const makeGuestDeps = (state: GameState, patches: unknown[]) => ({
    stateRef: { current: state },
    guestSymbolRef: { current: 'O' as never },
    pendingGuestStateRef: { current: null },
    rematchPendingRef: { current: false },
    setState: (fn: (prev: never) => never) => patches.push(fn),
    stopTimer: () => {},
    clearRematchTimeout: () => {},
  });
  const withPlayers = { X: { username: 'Host' }, O: { username: 'Guest' } };

  it('ignores rematchRequested during an active game', () => {
    const state = gameState({
      gameStatus: GameStatus.ACTIVE,
      players: withPlayers,
      winner: null,
    } as never);
    const patches: unknown[] = [];
    handleGuestMessage(makeGuestDeps(state, patches) as never, {
      type: 'rematchRequested',
      requesterSymbol: 'X' as never,
    });
    expect(patches).toHaveLength(0);
  });

  it('accepts rematchRequested on a completed game', () => {
    const state = gameState({
      gameStatus: GameStatus.COMPLETED,
      players: withPlayers,
      winner: 'X' as never,
    } as never);
    const patches: Array<(prev: never) => { rematchIncoming?: boolean }> = [];
    handleGuestMessage(makeGuestDeps(state, patches) as never, {
      type: 'rematchRequested',
      requesterSymbol: 'X' as never,
    });
    expect(patches).toHaveLength(1);
    expect(patches[0]({} as never).rematchIncoming).toBe(true);
  });
});
