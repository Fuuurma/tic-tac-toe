// @vitest-environment jsdom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { GameModes } from "@/game/constants";
import { fetchMatchmakingHealth } from "@/lib/matchmaking";
import { usePlayerCount } from "@/hooks/usePlayerCount";
import { roomInvite } from "@/lib/roomId";
import { LobbyForm } from "./lobbyForm";

// A configured build whose relay never answers: no poll has ever
// succeeded, so the Online tile disables with the reason instead of
// offering dead Quick/Create/Join actions.
vi.mock("@/lib/matchmaking", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/matchmaking")>()),
  MATCHMAKING_CONFIGURED: true,
  ONLINE_UNAVAILABLE: false,
  fetchMatchmakingHealth: vi.fn(),
}));

let browserOnline = true;
Object.defineProperty(navigator, "onLine", {
  configurable: true,
  get: () => browserOnline,
});

const setBrowserOnline = (next: boolean) => {
  browserOnline = next;
  window.dispatchEvent(new Event(next ? "online" : "offline"));
};

afterEach(cleanup);

beforeEach(() => {
  browserOnline = true;
  vi.mocked(fetchMatchmakingHealth).mockReset();
  vi.mocked(fetchMatchmakingHealth).mockRejectedValue(
    new Error("connect ECONNREFUSED 127.0.0.1:8787"),
  );
});

const DOWN_REASON =
"Online mode isn't available. Try again later.";
const OFFLINE_REASON =
"You're offline. Online play is paused until you reconnect.";

describe("LobbyForm opened while the device is offline", () => {
  it("keeps an invite's Join setup visible and paused with its code", async () => {
    browserOnline = false;
    render(<LobbyForm roomInvite={roomInvite("friday-game")} onStart={vi.fn()} />);

    const online = screen.getByRole("radio", { name: "Online" });
    await waitFor(() => expect(online.getAttribute("aria-disabled")).toBe("true"));

    expect(fetchMatchmakingHealth).not.toHaveBeenCalled();
    expect(screen.queryByText(DOWN_REASON)).toBeNull();
    expect(screen.getAllByText(OFFLINE_REASON).length).toBeGreaterThan(0);
    expect(
      (screen.getByRole("textbox", { name: /Room code/ }) as HTMLInputElement)
        .value,
    ).toBe("friday-game");
    expect(
      (screen.getByRole("button", { name: "Join Room" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    for (const name of ["vs Computer", "vs Friend"]) {
      expect(
        screen.getByRole("radio", { name }).getAttribute("aria-disabled"),
      ).toBeNull();
    }
  });
});

describe("LobbyForm with an unreachable relay", () => {
  it("starts enabled while reachability is unknown", () => {
    render(<LobbyForm onStart={vi.fn()} />);

    // The first poll is still in flight: unknown reads as enabled, never
    // flickering. The failure below flips it.
    expect(
      (screen.getByRole("radio", { name: "Online" }) as HTMLButtonElement).disabled,
    ).toBe(false);
  });

  it("marks the Online tile unavailable once the relay proves unreachable", async () => {
    render(<LobbyForm onStart={vi.fn()} />);

    const online = screen.getByRole("radio", { name: "Online" });
    await waitFor(() => expect(online.getAttribute("aria-disabled")).toBe("true"));
    // Nothing nags until tapped, even after the failure lands.
    expect(screen.queryByText(DOWN_REASON)).toBeNull();

    fireEvent.click(online);
    expect(screen.getByText(DOWN_REASON)).toBeTruthy();
  });

  it("falls back to Computer on an invite link once down is proven", async () => {
    render(<LobbyForm roomInvite={roomInvite("friday-game")} onStart={vi.fn()} />);

    const online = screen.getByRole("radio", { name: "Online" });
    await waitFor(() => expect(online.getAttribute("aria-disabled")).toBe("true"));
    expect(
      (screen.getByRole("button", { name: "Start Game" }) as HTMLButtonElement).disabled,
    ).toBe(false);
  });
});

describe("LobbyForm when the device goes offline", () => {
  beforeAll(async () => {
    vi.mocked(fetchMatchmakingHealth).mockResolvedValue({
      game: "ttt",
      waiting: 3,
      matches: 0,
    });
    const { unmount } = renderHook(() => usePlayerCount(true, undefined, true));
    await waitFor(() =>
      expect(vi.mocked(fetchMatchmakingHealth)).toHaveBeenCalled(),
    );
    await act(async () => {});
    unmount();
  });

  it("hides the stale player count and pauses Online with the room draft kept", async () => {
    vi.mocked(fetchMatchmakingHealth).mockResolvedValue({
      game: "ttt",
      waiting: 3,
      matches: 0,
    });
    render(<LobbyForm roomInvite={roomInvite("friday-game")} onStart={vi.fn()} />);

    await waitFor(() => expect(screen.getByText(/players online/)).toBeTruthy());

    act(() => setBrowserOnline(false));

    await waitFor(() => expect(screen.queryByText(/players online/)).toBeNull());
    const online = screen.getByRole("radio", { name: "Online" });
    expect(online.getAttribute("aria-disabled")).toBe("true");
    expect(screen.queryByText(DOWN_REASON)).toBeNull();
    expect(screen.getAllByText(OFFLINE_REASON).length).toBeGreaterThan(0);
    expect(
      (screen.getByRole("textbox", { name: /Room code/ }) as HTMLInputElement)
        .value,
    ).toBe("friday-game");
    expect(
      (screen.getByRole("button", { name: "Join Room" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it("blocks a dispatched submit while offline", async () => {
    browserOnline = false;
    const onStart = vi.fn();
    const { container } = render(
      <LobbyForm roomInvite={roomInvite("friday-game")} onStart={onStart} />,
    );

    await waitFor(() =>
      expect(screen.getAllByText(OFFLINE_REASON).length).toBeGreaterThan(0),
    );
    const form = container.querySelector("form");
    if (!form) throw new Error("lobby form not rendered");
    fireEvent.submit(form);
    expect(onStart).not.toHaveBeenCalled();
  });

  it("submits the original Join payload once the device is back online", async () => {
    vi.mocked(fetchMatchmakingHealth).mockResolvedValue({
      game: "ttt",
      waiting: 2,
      matches: 0,
    });
    browserOnline = false;
    const onStart = vi.fn();
    const { container } = render(
      <LobbyForm roomInvite={roomInvite("friday-game")} onStart={onStart} />,
    );

    await waitFor(() =>
      expect(screen.getAllByText(OFFLINE_REASON).length).toBeGreaterThan(0),
    );
    const form = container.querySelector("form");
    if (!form) throw new Error("lobby form not rendered");
    fireEvent.submit(form);
    expect(onStart).not.toHaveBeenCalled();

    act(() => setBrowserOnline(true));

    await waitFor(() => expect(screen.getByText(/players online/)).toBeTruthy());
    await waitFor(() =>
      expect(
        (screen.getByRole("button", { name: "Join Room" }) as HTMLButtonElement)
          .disabled,
      ).toBe(false),
    );
    fireEvent.submit(form);
    expect(onStart).toHaveBeenCalledTimes(1);
    expect(onStart).toHaveBeenCalledWith(
      expect.objectContaining({
        gameMode: GameModes.ONLINE,
        onlineAction: "join",
        onlineRoomId: "friday-game",
      }),
    );
  });
});
