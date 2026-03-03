import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { createTestServer, createClient, PlayerSymbol, GameStatus, GAME_RULES } from "../helpers/testServer.js";

describe("Socket Integration Tests", () => {
  let server;
  let serverUrl;

  beforeAll(async () => {
    server = await createTestServer();
    serverUrl = `http://localhost:${server.port}`;
  });

  afterAll(async () => {
    return new Promise((resolve) => {
      server.httpServer.close(() => resolve());
    });
  });

  describe("Connection and Login", () => {
    it("should connect client successfully", async () => {
      const client = createClient(serverUrl);
      
      await new Promise((resolve) => {
        client.on("connect", resolve);
        client.connect();
      });

      expect(client.connected).toBe(true);
      client.disconnect();
    });

    it("should assign player symbol on login", async () => {
      const client = createClient(serverUrl);
      
      const assigned = await new Promise((resolve) => {
        client.on("playerAssigned", resolve);
        client.connect();
        client.emit("login", "Player1", "blue");
      });

      expect(assigned.symbol).toBe(PlayerSymbol.X);
      expect(assigned.roomId).toBeDefined();
      expect(assigned.assignedColor).toBe("blue");

      client.disconnect();
    });

    it("should reject empty username", async () => {
      const client = createClient(serverUrl);
      
      const error = await new Promise((resolve) => {
        client.on("error", resolve);
        client.connect();
        client.emit("login", "", "blue");
      });

      expect(error).toBe("Invalid username");
      client.disconnect();
    });

    it("should reject already logged in player", async () => {
      const client = createClient(serverUrl);
      
      await new Promise((resolve) => {
        client.on("playerAssigned", resolve);
        client.connect();
        client.emit("login", "Player1", "blue");
      });

      const error = await new Promise((resolve) => {
        client.on("error", resolve);
        client.emit("login", "Player1", "blue");
      });

      expect(error).toBe("Already logged in");
      client.disconnect();
    });
  });

  describe("Matchmaking", () => {
    it("should pair two players in same room", async () => {
      const client1 = createClient(serverUrl);
      const client2 = createClient(serverUrl);

      const assigned1 = await new Promise((resolve) => {
        client1.on("playerAssigned", resolve);
        client1.connect();
        client1.emit("login", "Player1", "blue");
      });

      const assigned2 = await new Promise((resolve) => {
        client2.on("playerAssigned", resolve);
        client2.connect();
        client2.emit("login", "Player2", "red");
      });

      expect(assigned1.roomId).toBe(assigned2.roomId);
      expect(assigned1.symbol).toBe(PlayerSymbol.X);
      expect(assigned2.symbol).toBe(PlayerSymbol.O);

      client1.disconnect();
      client2.disconnect();
    });

    it("should emit gameStart when room is full", async () => {
      const client1 = createClient(serverUrl);
      const client2 = createClient(serverUrl);

      await new Promise((resolve) => {
        client1.on("playerAssigned", resolve);
        client1.connect();
        client1.emit("login", "Player1", "blue");
      });

      const gameStart = await new Promise((resolve) => {
        client1.on("gameStart", resolve);
        client2.on("playerAssigned", () => {
          client2.emit("login", "Player2", "red");
        });
        client2.on("gameStart", resolve);
        client2.connect();
        client2.emit("login", "Player2", "red");
      });

      expect(gameStart.gameStatus).toBe(GameStatus.ACTIVE);
      expect(gameStart.currentPlayer).toBe(PlayerSymbol.X);

      client1.disconnect();
      client2.disconnect();
    });

    it("should emit playerJoined when second player joins", async () => {
      const client1 = createClient(serverUrl);
      const client2 = createClient(serverUrl);

      await new Promise((resolve) => {
        client1.on("playerAssigned", resolve);
        client1.connect();
        client1.emit("login", "Player1", "blue");
      });

      const playerJoined = await new Promise((resolve) => {
        client1.on("playerJoined", resolve);
        client2.connect();
        client2.emit("login", "Player2", "red");
      });

      expect(playerJoined.username).toBe("Player2");
      expect(playerJoined.symbol).toBe(PlayerSymbol.O);

      client1.disconnect();
      client2.disconnect();
    });
  });

  describe("Game Moves", () => {
    it("should broadcast move to both players", async () => {
      const client1 = createClient(serverUrl);
      const client2 = createClient(serverUrl);

      await new Promise((resolve) => {
        client1.on("playerAssigned", resolve);
        client1.connect();
        client1.emit("login", "Player1", "blue");
      });

      await new Promise((resolve) => {
        client2.on("playerAssigned", resolve);
        client2.connect();
        client2.emit("login", "Player2", "red");
      });

      await Promise.all([
        new Promise((resolve) => client1.on("gameStart", resolve)),
        new Promise((resolve) => client2.on("gameStart", resolve)),
      ]);

      const [update1, update2] = await Promise.all([
        new Promise((resolve) => client1.on("gameUpdate", resolve)),
        new Promise((resolve) => client2.on("gameUpdate", resolve)),
        client1.emit("move", 4),
      ]);

      expect(update1.board[4]).toBe(PlayerSymbol.X);
      expect(update2.board[4]).toBe(PlayerSymbol.X);
      expect(update1.currentPlayer).toBe(PlayerSymbol.O);

      client1.disconnect();
      client2.disconnect();
    });

    it("should reject move when not player's turn", async () => {
      const client1 = createClient(serverUrl);
      const client2 = createClient(serverUrl);

      await new Promise((resolve) => {
        client1.on("playerAssigned", resolve);
        client1.connect();
        client1.emit("login", "Player1", "blue");
      });

      await new Promise((resolve) => {
        client2.on("playerAssigned", resolve);
        client2.connect();
        client2.emit("login", "Player2", "red");
      });

      await Promise.all([
        new Promise((resolve) => client1.on("gameStart", resolve)),
        new Promise((resolve) => client2.on("gameStart", resolve)),
      ]);

      const error = await new Promise((resolve) => {
        client2.on("error", resolve);
        client2.emit("move", 4);
      });

      expect(error).toBe("Invalid move");

      client1.disconnect();
      client2.disconnect();
    });

    it("should detect winner", async () => {
      const client1 = createClient(serverUrl);
      const client2 = createClient(serverUrl);

      await new Promise((resolve) => {
        client1.on("playerAssigned", resolve);
        client1.connect();
        client1.emit("login", "Player1", "blue");
      });

      await new Promise((resolve) => {
        client2.on("playerAssigned", resolve);
        client2.connect();
        client2.emit("login", "Player2", "red");
      });

      await Promise.all([
        new Promise((resolve) => client1.on("gameStart", resolve)),
        new Promise((resolve) => client2.on("gameStart", resolve)),
      ]);

      const moves = [
        { client: client1, pos: 0 },
        { client: client2, pos: 3 },
        { client: client1, pos: 1 },
        { client: client2, pos: 4 },
        { client: client1, pos: 2 },
      ];

      let lastUpdate;
      for (const move of moves) {
        lastUpdate = await new Promise((resolve) => {
          client1.once("gameUpdate", resolve);
          client2.once("gameUpdate", resolve);
          move.client.emit("move", move.pos);
        });
      }

      expect(lastUpdate.winner).toBe(PlayerSymbol.X);

      client1.disconnect();
      client2.disconnect();
    });
  });

  describe("Rematch", () => {
    it("should handle rematch request", async () => {
      const client1 = createClient(serverUrl);
      const client2 = createClient(serverUrl);

      await new Promise((resolve) => {
        client1.on("playerAssigned", resolve);
        client1.connect();
        client1.emit("login", "Player1", "blue");
      });

      await new Promise((resolve) => {
        client2.on("playerAssigned", resolve);
        client2.connect();
        client2.emit("login", "Player2", "red");
      });

      await Promise.all([
        new Promise((resolve) => client1.on("gameStart", resolve)),
        new Promise((resolve) => client2.on("gameStart", resolve)),
      ]);

      const rematchRequested = await new Promise((resolve) => {
        client2.on("rematchRequested", resolve);
        client1.emit("requestRematch");
      });

      expect(rematchRequested.requesterSymbol).toBe(PlayerSymbol.X);

      client1.disconnect();
      client2.disconnect();
    });

    it("should reset game on rematch accept", async () => {
      const client1 = createClient(serverUrl);
      const client2 = createClient(serverUrl);

      await new Promise((resolve) => {
        client1.on("playerAssigned", resolve);
        client1.connect();
        client1.emit("login", "Player1", "blue");
      });

      await new Promise((resolve) => {
        client2.on("playerAssigned", resolve);
        client2.connect();
        client2.emit("login", "Player2", "red");
      });

      await Promise.all([
        new Promise((resolve) => client1.on("gameStart", resolve)),
        new Promise((resolve) => client2.on("gameStart", resolve)),
      ]);

      const gameReset = await new Promise((resolve) => {
        client1.on("gameReset", resolve);
        client2.on("gameReset", resolve);
        client1.emit("requestRematch");
        client2.emit("acceptRematch");
      });

      expect(gameReset.board.every((cell) => cell === null)).toBe(true);
      expect(gameReset.winner).toBe(null);

      client1.disconnect();
      client2.disconnect();
    });
  });

  describe("Disconnection", () => {
    it("should notify opponent when player leaves", async () => {
      const client1 = createClient(serverUrl);
      const client2 = createClient(serverUrl);

      await new Promise((resolve) => {
        client1.on("playerAssigned", resolve);
        client1.connect();
        client1.emit("login", "Player1", "blue");
      });

      await new Promise((resolve) => {
        client2.on("playerAssigned", resolve);
        client2.connect();
        client2.emit("login", "Player2", "red");
      });

      await Promise.all([
        new Promise((resolve) => client1.on("gameStart", resolve)),
        new Promise((resolve) => client2.on("gameStart", resolve)),
      ]);

      const playerLeft = await new Promise((resolve) => {
        client1.on("playerLeft", resolve);
        client2.disconnect();
      });

      expect(playerLeft.symbol).toBe(PlayerSymbol.O);

      client1.disconnect();
    });
  });
});