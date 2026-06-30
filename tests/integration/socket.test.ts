import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import {
  createTestServer,
  createClient,
  PlayerSymbol,
  GameStatus,
  TURN_DURATION_MS,
} from "../helpers/testServer.js";

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
      expect(start1.winningCombination).toBeNull();
      expect(start1.lastMoveIndex).toBeNull();
      expect(start1.moveCount).toBe(0);
    });

    it("should assign a different color when online players request the same color", async () => {
      const p1Assigned = new Promise((resolve) => client1.on("playerAssigned", resolve));
      const p2Assigned = new Promise((resolve) => client2.on("playerAssigned", resolve));
      const p2ColorChanged = new Promise((resolve) => client2.on("colorChanged", resolve));
      const p1Start = new Promise((resolve) => client1.on("gameStart", resolve));
      const p2Start = new Promise((resolve) => client2.on("gameStart", resolve));

      client1.emit("login", "Player1", "blue");
      client2.emit("login", "Player2", "blue");

      const [assigned1, assigned2, colorChanged, start1, start2] =
        await Promise.all([p1Assigned, p2Assigned, p2ColorChanged, p1Start, p2Start]);

      expect(assigned1.assignedColor).toBe("blue");
      expect(assigned2.assignedColor).not.toBe("blue");
      expect(colorChanged.newColor).toBe(assigned2.assignedColor);
      expect(start1.players.X.color).not.toBe(start1.players.O.color);
      expect(start2.players.X.color).not.toBe(start2.players.O.color);
    });

    it("should preserve distinct non-default online colors", async () => {
      const p1Assigned = new Promise((resolve) => client1.on("playerAssigned", resolve));
      const p2Assigned = new Promise((resolve) => client2.on("playerAssigned", resolve));
      const p1Start = new Promise((resolve) => client1.on("gameStart", resolve));
      const p2Start = new Promise((resolve) => client2.on("gameStart", resolve));

      client1.emit("login", "Player1", "green");
      client2.emit("login", "Player2", "purple");

      const [assigned1, assigned2, start1, start2] =
        await Promise.all([p1Assigned, p2Assigned, p1Start, p2Start]);

      expect(assigned1.assignedColor).toBe("green");
      expect(assigned2.assignedColor).toBe("purple");
      expect(start1.players.X.color).toBe("green");
      expect(start1.players.O.color).toBe("purple");
      expect(start2.players.X.color).toBe("green");
      expect(start2.players.O.color).toBe("purple");
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
      expect(update1.lastMoveIndex).toBe(4);
      expect(update1.moveCount).toBe(1);
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
      expect(lastUpdate.winningCombination).toEqual([0, 1, 2]);
      expect(lastUpdate.lastMoveIndex).toBe(2);
      expect(lastUpdate.moveCount).toBe(5);
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

    it("should reset a room and reuse the vacant symbol after a player leaves", async () => {
      const p1Start = new Promise((resolve) => client1.on("gameStart", resolve));
      const p2Start = new Promise((resolve) => client2.on("gameStart", resolve));
      client1.emit("login", "P1", "blue");
      client2.emit("login", "P2", "red");
      await Promise.all([p1Start, p2Start]);

      const p1Update = new Promise((resolve) => client1.once("gameUpdate", resolve));
      const p2Update = new Promise((resolve) => client2.once("gameUpdate", resolve));
      client1.emit("move", 4);
      await Promise.all([p1Update, p2Update]);

      const p2PlayerLeft = new Promise((resolve) => client2.once("playerLeft", resolve));
      client1.emit("leaveRoom");
      const leftPayload = await p2PlayerLeft;

      expect(leftPayload.symbol).toBe(PlayerSymbol.X);
      expect(leftPayload.gameState.gameStatus).toBe(GameStatus.WAITING);
      expect(leftPayload.gameState.board.every((cell) => cell === null)).toBe(true);
      expect(leftPayload.gameState.players.O.username).toBe("P2");

      const client3 = createClient(serverUrl);
      client3.connect();
      await new Promise((resolve) => client3.on("connect", resolve));

      try {
        const p3Assigned = new Promise((resolve) => client3.on("playerAssigned", resolve));
        const p2Restart = new Promise((resolve) => client2.once("gameStart", resolve));
        const p3Start = new Promise((resolve) => client3.once("gameStart", resolve));

        client3.emit("login", "P3", "green");

        const [assigned3, restart2, start3] = await Promise.all([
          p3Assigned,
          p2Restart,
          p3Start,
        ]);

        expect(assigned3.symbol).toBe(PlayerSymbol.X);
        expect(start3.players.X.username).toBe("P3");
        expect(start3.players.O.username).toBe("P2");
        expect(restart2.board.every((cell) => cell === null)).toBe(true);
        expect(start3.gameStatus).toBe(GameStatus.ACTIVE);
      } finally {
        client3.disconnect();
      }
    });
  });

  describe("Server Timers", () => {
    it("should broadcast a server-authoritative timeout move to both players", async () => {
      const timedServer = await createTestServer(0, {
        turnTimerIntervalMs: 10,
        turnTimerStepMs: TURN_DURATION_MS,
      });
      const timedServerUrl = `http://localhost:${timedServer.port}`;
      const client1 = createClient(timedServerUrl);
      const client2 = createClient(timedServerUrl);

      try {
        client1.connect();
        client2.connect();

        await Promise.all([
          new Promise((resolve) => client1.on("connect", resolve)),
          new Promise((resolve) => client2.on("connect", resolve)),
        ]);

        const p1Start = new Promise((resolve) => client1.once("gameStart", resolve));
        const p2Start = new Promise((resolve) => client2.once("gameStart", resolve));
        const p1Update = new Promise((resolve) => client1.once("gameUpdate", resolve));
        const p2Update = new Promise((resolve) => client2.once("gameUpdate", resolve));

        client1.emit("login", "Timer1", "blue");
        client2.emit("login", "Timer2", "red");

        await Promise.all([p1Start, p2Start]);
        const [update1, update2] = await Promise.all([p1Update, p2Update]);

        expect(update1.board.filter(Boolean)).toHaveLength(1);
        expect(update1.currentPlayer).toBe(PlayerSymbol.O);
        expect(update1.lastMoveIndex).not.toBeNull();
        expect(update1.moveCount).toBe(1);
        expect(update1.winningCombination).toBeNull();
        expect(update1.turnTimeRemaining).toBe(TURN_DURATION_MS);
        expect(update2.board).toEqual(update1.board);
        expect(update2.currentPlayer).toBe(update1.currentPlayer);
      } finally {
        client1.disconnect();
        client2.disconnect();
        await new Promise((resolve) => timedServer.httpServer.close(() => resolve(undefined)));
      }
    });
  });
});
