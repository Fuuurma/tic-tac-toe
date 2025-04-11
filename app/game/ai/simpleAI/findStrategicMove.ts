function findStrategicMove(
  state: GameState,
  symbol: PlayerSymbol
): BoardPosition | null {
  for (const line of WINNING_COMBINATIONS) {
    const lineContent = getLineState(state.board, line);
    const criticalMove = findCriticalMoveInLine(line, lineContent, symbol);
    if (criticalMove !== null) {
      return criticalMove;
    }
  }
  return null;
}
