import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createTestServer, createClient, PlayerSymbol } from "../helpers/testServer.js";

describe("Load Tests - 500 Concurrent Connections", () => {
  let server;
  let serverUrl;
  const CLIENT_COUNT = 500;

  beforeAll(async () => {
    server = await createTestServer();
    serverUrl = `http://localhost:${server.port}`;
  }, 30000);

  afterAll(async () => {
    return new Promise((resolve) => {
      server.httpServer.close(() => resolve());
    });
  });

  it("should handle 500 concurrent connections", async () => {
    const clients = [];
    const connectionTimes = [];
    const startTime = Date.now();
    const BATCH_SIZE = 50;

    for (let i = 0; i < CLIENT_COUNT; i++) {
      const client = createClient(serverUrl);
      clients.push(client);
    }

    for (let batch = 0; batch < CLIENT_COUNT / BATCH_SIZE; batch++) {
      const batchStart = batch * BATCH_SIZE;
      const batchEnd = batchStart + BATCH_SIZE;
      const batchClients = clients.slice(batchStart, batchEnd);

      const connectionPromises = batchClients.map((client) => {
        return new Promise((resolve) => {
          const clientStart = Date.now();
          client.on("connect", () => {
            connectionTimes.push(Date.now() - clientStart);
            resolve(true);
          });
          client.on("connect_error", () => resolve(false));
          client.connect();
        });
      });

      await Promise.all(connectionPromises);
      await new Promise((r) => setTimeout(r, 50));
    }

    const totalTime = Date.now() - startTime;
    const connectedCount = clients.filter((c) => c.connected).length;
    const successRate = (connectedCount / CLIENT_COUNT) * 100;
    const avgConnectionTime = connectionTimes.length > 0
      ? Math.round(connectionTimes.reduce((a, b) => a + b, 0) / connectionTimes.length)
      : 0;

    console.log(`\n[500 Connections Load Test Results]`);
    console.log(`  Total clients: ${CLIENT_COUNT}`);
    console.log(`  Connected: ${connectedCount}`);
    console.log(`  Success rate: ${successRate.toFixed(2)}%`);
    console.log(`  Total time: ${totalTime}ms`);
    console.log(`  Avg connection time: ${avgConnectionTime}ms`);
    console.log(`  Max connection time: ${Math.max(...connectionTimes)}ms`);
    console.log(`  Min connection time: ${Math.min(...connectionTimes)}ms`);

    expect(successRate).toBeGreaterThanOrEqual(95);

    clients.forEach((c) => c.disconnect());
  }, 180000);

  it("should handle 250 concurrent games (500 players)", async () => {
    const clients = [];
    let gamesStarted = 0;
    const startTime = Date.now();

    for (let i = 0; i < CLIENT_COUNT; i++) {
      const client = createClient(serverUrl);
      clients.push(client);
    }

    const gamePromises = clients.map((client, index) => {
      return new Promise((resolve) => {
        const pairNum = Math.floor(index / 2);
        const isX = index % 2 === 0;
        const playerName = `Game${pairNum}_${isX ? "X" : "O"}`;

        client.on("connect", () => {
          client.emit("login", playerName, isX ? "blue" : "red");
        });

        client.on("gameStart", () => {
          gamesStarted++;
          resolve(true);
        });

        client.on("error", () => resolve(false));

        client.connect();
      });
    });

    const results = await Promise.all(gamePromises);
    const totalTime = Date.now() - startTime;
    const successCount = results.filter(Boolean).length;
    const successRate = (successCount / CLIENT_COUNT) * 100;

    console.log(`\n[250 Concurrent Games Results]`);
    console.log(`  Total clients: ${CLIENT_COUNT}`);
    console.log(`  Successful clients: ${successCount}`);
    console.log(`  Success rate: ${successRate.toFixed(2)}%`);
    console.log(`  Games started: ${gamesStarted / 2}`);
    console.log(`  Total time: ${totalTime}ms`);

    expect(successRate).toBeGreaterThanOrEqual(90);

    clients.forEach((c) => c.disconnect());
  }, 120000);
});