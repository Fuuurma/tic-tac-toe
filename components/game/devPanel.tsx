import { GameState } from "@/app/types/types";
import { Socket } from "socket.io-client";

interface DevPanelProps {
  gameState: GameState;
  username: string;
  socket: Socket | null;
}

const DevPanel: React.FC<DevPanelProps> = ({ gameState, username, socket }) => {
  return (
    <div
      style={{
        position: "fixed",
        bottom: 20,
        right: 20,
        zIndex: 9999,
        backgroundColor: "#1e293b", // slate-800
        color: "#f8fafc", // slate-50
        padding: "1rem",
        borderRadius: "0.5rem",
        width: "350px",
        maxHeight: "90vh",
        overflowY: "auto",
        fontSize: "0.75rem",
        fontFamily: "monospace",
      }}
    >
      <strong>👤 Username:</strong> {username || "N/A"}
      <br />
      <strong>📶 Socket Connected:</strong>{" "}
      {socket?.connected ? "✅ Yes" : "❌ No"}
      <br />
      <strong>🎮 Game Mode:</strong> {gameState.gameMode}
      <br />
      <strong>🕹️ Current Player:</strong> {gameState.currentPlayer}
      <br />
      <strong>🏆 Winner:</strong> {gameState.winner || "—"}
      <br />
      <strong>📊 Game Status:</strong> {gameState.gameStatus}
      <br />
      <hr style={{ margin: "0.5rem 0", borderColor: "#64748b" }} />
      <strong>🧑‍🤝‍🧑 Players:</strong>
      <pre style={{ whiteSpace: "pre-wrap" }}>
        {JSON.stringify(gameState.players, null, 2)}
      </pre>
      <strong>🧠 Moves:</strong>
      <pre style={{ whiteSpace: "pre-wrap" }}>
        {JSON.stringify(gameState.moves, null, 2)}
      </pre>
      <strong>🧱 Board:</strong>
      <pre style={{ whiteSpace: "pre-wrap" }}>
        {JSON.stringify(gameState.board, null, 2)}
      </pre>
      <strong>🕐 Time Left:</strong> {gameState.turnTimeRemaining ?? "N/A"}
    </div>
  );
};
export default DevPanel;
