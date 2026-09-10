import { describe, expect, it } from 'vitest';
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
  it('restores the pending snapshot on host "Invalid move"', () => {
    const authoritative = gameState({ turnTimeRemaining: 20_000 });
    const pendingGuestStateRef = { current: authoritative };
    const stateRef = { current: gameState({ board: ['X'] } as never) };
    const patches: unknown[] = [];
    const deps = {
      stateRef,
      guestSymbolRef: { current: 'O' as never },
      pendingGuestStateRef,
      setState: (fn: (prev: never) => never) => patches.push(fn),
      stopTimer: () => {},
    };

    handleGuestMessage(deps as never, { type: 'error', message: 'Invalid move' });

    expect(stateRef.current).toBe(authoritative);
    expect(pendingGuestStateRef.current).toBeNull();
    expect(patches).toHaveLength(1);
  });

  it('treats other host errors as display-only (no rollback)', () => {
    const stateRef = { current: gameState({}) };
    const pendingGuestStateRef = { current: gameState({}) };
    const deps = {
      stateRef,
      guestSymbolRef: { current: 'O' as never },
      pendingGuestStateRef,
      setState: () => {},
      stopTimer: () => {},
    };

    const before = stateRef.current;
    handleGuestMessage(deps as never, { type: 'error', message: 'Room closed' });

    // No rollback: board state untouched, snapshot kept.
    expect(stateRef.current).toBe(before);
    expect(pendingGuestStateRef.current).not.toBeNull();
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
    hostRematchPendingRef: { current: true },
    hostPendingSettingsRef: { current: null },
    setState: () => {},
    commitHostState: () => {},
    broadcastGameState: () => {},
    stopTimer: () => {},
  });

  it('keeps each player their own identity when symbols swap on rematch', () => {
    // Host was X, guest was O. New host symbol = O (a swap).
    const state = completed('Alice', 'Bob');
    const sent: Array<{ type: string; gameState: GameState }> = [];
    const deps = makeDeps(state, 'X', sent);

    handleHostMessage(deps as never, { type: 'rematchAccept' });

    const reset = sent.find((m) => m.type === 'gameStart')?.gameState;
    expect(reset).toBeTruthy();
    // Identity invariant (symbol-agnostic — randomPlayerSymbol decides
    // swap or not): the OLD host (Alice) sits at the NEW host symbol
    // and the old guest (Bob) takes the other seat.
    const newHostSymbol: 'X' | 'O' = deps.hostSymbolRef.current;
    expect(reset?.players[newHostSymbol].username).toBe('Alice');
    const otherSymbol: 'X' | 'O' = newHostSymbol === 'X' ? 'O' : 'X';
    expect(reset?.players[otherSymbol].username).toBe('Bob');
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
      setState: (fn: (prev: never) => never) => {
        lastState = fn({ guestSymbol: 'O' } as never);
      },
      stopTimer: () => {},
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
      setState: (fn: (prev: never) => never) => {
        lastState = fn({ guestSymbol: 'O' } as never);
      },
      stopTimer: () => {},
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
