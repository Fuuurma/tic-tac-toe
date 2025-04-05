export const createInitialGameState = (
  username: string,
  gameMode: GameMode,
  options: {
    opponentName?: string;
    playerColor: Color;
    opponentColor: Color;
  }
): GameState => {
  const baseState = createFreshGameState();

  return {
    ...baseState,
    gameMode,
    gameStatus: getInitialGameStatus(gameMode),
    players: {
      [PlayerSymbol.X]: createPlayerConfig({
        username,
        color: options.playerColor,
        symbol: PlayerSymbol.X,
        type: PlayerTypes.HUMAN,
        isActive: true,
      }),
      [PlayerSymbol.O]: createPlayerConfig({
        username: getOpponentName(gameMode, options.opponentName),
        color: options.opponentColor,
        symbol: PlayerSymbol.O,
        type: getOpponentType(gameMode),
        isActive: shouldActivateOpponent(gameMode),
      }),
    },
  };
};
