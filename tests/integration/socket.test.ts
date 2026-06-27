import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import { createTestServer, createClient, PlayerSymbol, GameStatus } from "../helpers/testServer.js";

describe("Socket Integration Tests", () => {
  let server;
  let serverUrl;

  beforeAll(async () => {
    server = await createTestServer();
    serverUrl = `http://localhost:${server.port}`;
  });

  afterAll(async () => {
    if (server && server.httpServer) {
      return new Promise((resolve) => {
        server.httpServer.close(() => resolve());
      });
    }
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
      client.connect();
      
      const assigned = await new Promise((resolve) => {
        client.on("playerAssigned", resolve);
        client.emit("login", "Player1", "blue");
      });

      expect(assigned.symbol).toBe(PlayerSymbol.X);
      expect(assigned.roomId).toBeDefined();
      expect(assigned.assignedColor).toBe("blue");

      client.disconnect();
    });
  });

  describe("Game Logic", () => {
    let client1, client2;

    beforeEach(async () => {
      client1 = createClient(serverUrl);
      client2 = createClient(serverUrl);
      client1.connect();
      client2.connect();
      
      await Promise.all([
        new Promise(r => client1.on("connect", r)),
        new Promise(r => client2.on("connect", r))
      ]);
    });

    afterEach(() => {
      if (client1) client1.disconnect();
      if (client2) client2.disconnect();
    });

    it("should pair two players and start game", async () => {
      const p1Start = new Promise((resolve) => client1.on("gameStart", resolve));
      const p2Start = new Promise((resolve) => client2.on("gameStart", resolve));

      client1.emit("login", "Player1", "blue");
      client2.emit("login", "Player2", "red");

      const [start1, start2] = await Promise.all([p1Start, p2Start]);

      expect(start1.gameStatus).toBe(GameStatus.ACTIVE);
      expect(start2.gameStatus).toBe(GameStatus.ACTIVE);
      expect(start1.players.X.username).toBe("Player1");
      expect(start1.players.O.username).toBe("Player2");
    });

    it("should broadcast move to both players", async () => {
      // Login and wait for start
      const p1Start = new Promise((resolve) => client1.on("gameStart", resolve));
      const p2Start = new Promise((resolve) => client2.on("gameStart", resolve));
      client1.emit("login", "P1", "blue");
      client2.emit("login", "P2", "red");
      await Promise.all([p1Start, p2Start]);

      // Make move and wait for update
      const p1Update = new Promise((resolve) => client1.on("gameUpdate", resolve));
      const p2Update = new Promise((resolve) => client2.on("gameUpdate", resolve));
      
      client1.emit("move", 4);
      
      const [update1, update2] = await Promise.all([p1Update, p2Update]);

      expect(update1.board[4]).toBe(PlayerSymbol.X);
      expect(update2.board[4]).toBe(PlayerSymbol.X);
      expect(update1.currentPlayer).toBe(PlayerSymbol.O);
    });

    it("should detect winner", async () => {
      const p1Start = new Promise((resolve) => client1.on("gameStart", resolve));
      const p2Start = new Promise((resolve) => client2.on("gameStart", resolve));
      client1.emit("login", "P1", "blue");
      client2.emit("login", "P2", "red");
      await Promise.all([p1Start, p2Start]);

      // X: 0, 1, 2 (Win)
      // O: 3, 4
      const moves = [0, 3, 1, 4, 2];
      let lastUpdate;

      for (let i = 0; i < moves.length; i++) {
        const move = moves[i];
        const activeClient = i % 2 === 0 ? client1 : client2;
        
        const p1Update = new Promise((resolve) => client1.once("gameUpdate", resolve));
        const p2Update = new Promise((resolve) => client2.once("gameUpdate", resolve));
        
        activeClient.emit("move", move);
        [lastUpdate] = await Promise.all([p1Update, p2Update]);
      }

      expect(lastUpdate.winner).toBe(PlayerSymbol.X);
      expect(lastUpdate.gameStatus).toBe(GameStatus.COMPLETED);
    });

    it("should handle rematch", async () => {
      // Setup game and finish it
      const p1Start = new Promise((resolve) => client1.on("gameStart", resolve));
      const p2Start = new Promise((resolve) => client2.on("gameStart", resolve));
      client1.emit("login", "P1", "blue");
      client2.emit("login", "P2", "red");
      await Promise.all([p1Start, p2Start]);

      // Quick win for X: 0, 1, 2
      const moves = [0, 3, 1, 4, 2];
      for (let i = 0; i < moves.length; i++) {
        const p1Update = new Promise((resolve) => client1.once("gameUpdate", resolve));
        const p2Update = new Promise((resolve) => client2.once("gameUpdate", resolve));
        (i % 2 === 0 ? client1 : client2).emit("move", moves[i]);
        await Promise.all([p1Update, p2Update]);
      }

      // Rematch request
      const p2RematchReq = new Promise((resolve) => client2.on("rematchRequested", resolve));
      client1.emit("requestRematch");
      await p2RematchReq;

      // Rematch accept
      const p1Reset = new Promise((resolve) => client1.on("gameReset", resolve));
      const p2Reset = new Promise((resolve) => client2.on("gameReset", resolve));
      client2.emit("acceptRematch");
      
      const [reset1] = await Promise.all([p1Reset, p2Reset]);
      expect(reset1.board.every(c => c === null)).toBe(true);
      expect(reset1.gameStatus).toBe(GameStatus.ACTIVE);
    });
  });
});
