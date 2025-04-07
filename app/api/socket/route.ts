import { createServer } from "http";
import { NextResponse } from "next/server";
import { GameServer } from "@/app/game/online/gameServer";

// --- Singleton Pattern for Server Initialization ---
// Use a closure or a simple object to ensure server starts only once.
const initSocketServer = (() => {
  let gameServerInstance: GameServer | null = null;
  let httpServer: ReturnType<typeof createServer> | null = null;

  return () => {
    if (!gameServerInstance) {
      console.log("Initializing Socket.IO server...");
      // Create a basic HTTP server instance (not linked to Next.js requests)
      httpServer = createServer();

      // Initialize the GameServer with this HTTP server
      gameServerInstance = new GameServer(httpServer);

      const port = parseInt(process.env.SOCKET_PORT || "3009", 10);
      httpServer.listen(port, () => {
        console.log(`✅ Socket.IO server listening on port ${port}`);
      });

      // Optional: Handle server errors
      httpServer.on("error", (error) => {
        console.error("HTTP Server Error:", error);
        // Potentially reset instance state if needed
        gameServerInstance = null;
        httpServer = null;
      });
    } else {
      console.log("Socket.IO server already running."); // Optional debug log
    }
    return { gameServerInstance, httpServer };
  };
})();
// --- End Singleton ---

// This API route now primarily serves to ENSURE the server is running
// and maybe return status, but doesn't handle socket connections directly.
export async function GET() {
  try {
    const { httpServer } = initSocketServer(); // Ensure the server starts if not already running

    if (!httpServer?.listening) {
      console.warn("Socket server HTTP instance not listening yet or failed.");
      // Throw an error or return a specific status
      return NextResponse.json({ status: "initializing" }, { status: 503 }); // Service Unavailable during init
    }

    // console.log("API route check: Socket server should be running.");
    return NextResponse.json({ status: "running" });
  } catch (error: any) {
    console.error("Error in /api/socket GET handler:", error);
    return NextResponse.json(
      { error: "Failed to initialize socket server", details: error.message },
      { status: 500 }
    );
  }
}

/**
 * IMPORTANT CONSIDERATIONS FOR DEPLOYMENT:
 * 1. Stateful Server: Socket.IO requires a long-running, stateful server process.
 * Serverless environments (like default Vercel deployments) are generally NOT suitable
 * because they spin down instances. You'll likely need a traditional Node.js server
 * hosting environment (like Vercel Hobby with persistent instances, Render, Railway, AWS EC2, etc.).
 * 2. Separate Port: You need to ensure the port (e.g., 3009) is accessible and properly mapped
 * in your deployment environment and that the client can reach it.
 * 3. Environment Variables: Use process.env variables for the port (SOCKET_PORT) and potentially
 * the client-side connection URL.
 */
