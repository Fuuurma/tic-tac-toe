const GameBoard = ({
  gameState,
  message,
  handleCellClick,
  resetGame,
  exitGame,
}: any) => (
  <Card className="w-full max-w-md">
    <CardHeader>
      <CardTitle>
        {gameState.gameMode === "computer"
          ? "Playing vs Computer"
          : "Multiplayer Game"}
      </CardTitle>
      <CardDescription>
        Playing as:{" "}
        <span className="font-bold">
          {gameState.currentPlayer || "Spectator"}
        </span>
      </CardDescription>
    </CardHeader>
    <CardContent>
      {message && (
        <div className="p-2 bg-blue-50 text-blue-700 rounded-md border border-blue-200">
          {message}
        </div>
      )}
      <div className="grid grid-cols-3 gap-2 mb-6 aspect-square">
        {gameState.board.map((cell, i) => (
          <button
            key={i}
            className="h-full w-full border rounded-md text-3xl"
            onClick={() => handleCellClick(i)}
            disabled={!!cell || !!gameState.winner}
          >
            {cell}
          </button>
        ))}
      </div>
    </CardContent>
    <CardFooter className="flex justify-between">
      <Button onClick={resetGame} variant="outline">
        Reset Game
      </Button>
      <Button onClick={exitGame} variant="ghost">
        Exit Game
      </Button>
    </CardFooter>
  </Card>
);
