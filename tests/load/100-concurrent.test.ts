import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createTestServer, createClient, PlayerSymbol } from "../helpers/testServer.js";

describe("Load Tests - 100 Concurrent Connections", () => {
  let server;
  let serverUrl;
  const CLIENT_COUNT = 100;

  beforeAll(async () => {
    server = await createTestServer();
    serverUrl = `http://localhost:${server.port}`;
  }, 30000);

  afterAll(async () => {
    return new Promise((resolve) => {
      server.httpServer.close(() => resolve());
    });
  });

  it("should handle 100 concurrent connections", async () => {
    const clients = [];
    const connectionTimes = [];
    const startTime = Date.now();

    for (let i = 0; i < CLIENT_COUNT; i++) {
      const client = createClient(serverUrl);
      clients.push(client);
    }

    const connectionPromises = clients.map((client) => {
      return new Promise((resolve) => {
        const clientStart = Date.now();
        client.on("connect", () => {
          connectionTimes.push(Date.now() - clientStart);
          resolve(true);
        });
        client.connect();
      });
    });

    await Promise.all(connectionPromises);
    const totalTime = Date.now() - startTime;

    const connectedCount = clients.filter((c) => c.connected).length;
    
    console.log(`\n[Load Test Results]`);
    console.log(`  Total clients: ${CLIENT_COUNT}`);
    console.log(`  Connected: ${connectedCount}`);
    console.log(`  Connection time (total): ${totalTime}ms`);
    console.log(`  Connection time (avg): ${Math.round(connectionTimes.reduce((a, b) => a + b, 0) / connectionTimes.length)}ms`);
    console.log(`  Connection time (max): ${Math.max(...connectionTimes)}ms`);

    expect(connectedCount).toBe(CLIENT_COUNT);

    clients.forEach((c) => c.disconnect());
  }, 60000);

  it("should handle 50 concurrent games (100 players)", async () => {
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
        const playerName = `Player${pairNum}_${isX ? "X" : "O"}`;

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

    console.log(`\n[Concurrent Games Results]`);
    console.log(`  Games started: ${gamesStarted / 2}`);
    console.log(`  Successful clients: ${successCount}`);
    console.log(`  Total time: ${totalTime}ms`);

    expect(successCount).toBeGreaterThanOrEqual(CLIENT_COUNT * 0.95);

    clients.forEach((c) => c.disconnect());
  }, 60000);

  it("should measure move broadcast latency", async () => {
    const client1 = createClient(serverUrl);
    const client2 = createClient(serverUrl);
    const latencies = [];

    await new Promise<void>((resolve) => { 
      client1.on("connect", () => resolve()); 
      client1.connect(); 
    });
    
    await new Promise<void>((resolve) => { 
      client2.on("connect", () => resolve()); 
      client2.connect(); 
    });

    await Promise.all([
      new Promise<void>((resolve) => { 
        client1.on("gameStart", () => resolve()); 
        client1.emit("login", "LatX", "blue"); 
      }),
      new Promise<void>((resolve) => { 
        client2.on("gameStart", () => resolve()); 
        client2.emit("login", "LatO", "red"); 
      }),
    ]);

    for (let i = 0; i < 3; i++) {
      const t = Date.now();
      await new Promise<void>((resolve) => { 
        client2.once("gameUpdate", () => resolve()); 
        client1.emit("move", i); 
      });
      latencies.push(Date.now() - t);

      if (i < 2) {
        await new Promise<void>((resolve) => { 
          client1.once("gameUpdate", () => resolve()); 
          client2.emit("move", i + 3); 
        });
      }
    }

    const avg = Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length);

    console.log(`\n[Move Broadcast Latency]`);
    console.log(`  Samples: ${latencies.length}`);
    console.log(`  Avg latency: ${avg}ms`);
    console.log(`  Min latency: ${Math.min(...latencies)}ms`);
    console.log(`  Max latency: ${Math.max(...latencies)}ms`);

    expect(avg).toBeLessThan(100);

    client1.disconnect();
    client2.disconnect();
  }, 30000);
});