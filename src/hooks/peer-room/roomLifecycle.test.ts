import { describe, it, expect, vi } from "vitest";
import type { RoomClient } from "@/lib/room";
import { leaveRoom } from "./roomLifecycle";

// F7 regression pin: every close path must send `{type:"leave"}` BEFORE
// closing the socket. A frame sent after close is silently dropped, so the
// peer/relay never learns the room was left deliberately.

function mockRoom() {
  const calls: string[] = [];
  let sendOk = true;
  const room = {
    send: vi.fn((msg: { type: string }) => {
      calls.push(`send:${msg.type}`);
      return sendOk;
    }),
    close: vi.fn(() => {
      calls.push("close");
    }),
  };
  return { room, calls, failNextSend: () => (sendOk = false) };
}

function refFor(room: unknown) {
  return { current: room as RoomClient | null };
}

describe("leaveRoom", () => {
  it("sends leave before close, then nulls the ref", () => {
    const { room, calls } = mockRoom();
    const ref = refFor(room);
    leaveRoom(ref);
    expect(room.send).toHaveBeenCalledTimes(1);
    expect(room.send).toHaveBeenCalledWith({ type: "leave" });
    expect(room.close).toHaveBeenCalledTimes(1);
    expect(calls).toEqual(["send:leave", "close"]);
    expect(ref.current).toBeNull();
  });

  it("send strictly precedes close (order, not just occurrence)", () => {
    const { room } = mockRoom();
    const ref = refFor(room);
    leaveRoom(ref);
    const order = [
      room.send.mock.invocationCallOrder[0],
      room.close.mock.invocationCallOrder[0],
    ];
    expect(order[0]).toBeLessThan(order[1]);
  });

  it("is a no-op on a null ref", () => {
    const ref = refFor(null);
    expect(() => leaveRoom(ref)).not.toThrow();
    expect(ref.current).toBeNull();
  });

  it("still closes when send reports failure (best-effort leave)", () => {
    const { room, calls, failNextSend } = mockRoom();
    failNextSend();
    const ref = refFor(room);
    leaveRoom(ref);
    expect(calls).toEqual(["send:leave", "close"]);
    expect(ref.current).toBeNull();
  });
});
