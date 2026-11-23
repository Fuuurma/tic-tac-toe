// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { GameModes, PlayerTypes } from "@/game/constants";
import { LobbyForm } from "./lobbyForm";

if (!HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute("open");
  };
}

afterEach(cleanup);

describe("LobbyForm online options", () => {
  it("marks Quick Match unavailable on tap and keeps Create working", () => {
    render(<LobbyForm onStart={vi.fn()} />);
    fireEvent.click(screen.getByRole("radio", { name: "Online" }));

    const quick = screen.getByRole("radio", { name: "Quick" });
    expect(quick.getAttribute("aria-disabled")).toBe("true");
    expect(
      screen.queryByText("Quick Match isn't available. Create or join a room instead."),
    ).toBeNull();

    fireEvent.click(quick);
    expect(
      screen.getByText("Quick Match isn't available. Create or join a room instead."),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("radio", { name: "Create" }));
    expect((screen.getByRole("button", { name: "Create Room" }) as HTMLButtonElement).disabled).toBe(false);
  });
});

describe("LobbyForm opponent type follows the game mode", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  const submitLobby = (container: HTMLElement) => {
    const form = container.querySelector("form");
    if (!form) throw new Error("lobby form not rendered");
    fireEvent.submit(form);
  };

  it("submits vs Computer with the computer opponent after opponent edits", () => {
    const onStart = vi.fn();
    const { container } = render(<LobbyForm onStart={onStart} />);

    fireEvent.click(screen.getByRole("button", { name: "Edit opponent settings" }));
    const dialog = screen.getByRole("dialog", { name: "Players" });
    expect(
      within(dialog).queryByRole("radiogroup", { name: "Opponent type" }),
    ).toBeNull();

    fireEvent.change(within(dialog).getByRole("textbox", { name: "Opponent name" }), {
      target: { value: "Rex" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));
    submitLobby(container);

    expect(onStart).toHaveBeenCalledWith(
      expect.objectContaining({
        gameMode: GameModes.VS_COMPUTER,
        opponentType: PlayerTypes.COMPUTER,
        opponentName: "Rex",
      }),
    );
  });

  it("submits vs Friend with the human opponent after opponent edits", () => {
    const onStart = vi.fn();
    const { container } = render(<LobbyForm onStart={onStart} />);

    fireEvent.click(screen.getByRole("radio", { name: "vs Friend" }));
    fireEvent.click(screen.getByRole("button", { name: "Edit opponent settings" }));
    const dialog = screen.getByRole("dialog", { name: "Players" });
    expect(
      within(dialog).queryByRole("radiogroup", { name: "Opponent type" }),
    ).toBeNull();
    expect(
      within(dialog).queryByRole("radiogroup", { name: "AI difficulty" }),
    ).toBeNull();

    fireEvent.change(within(dialog).getByRole("textbox", { name: "Opponent name" }), {
      target: { value: "Rex" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));
    submitLobby(container);

    expect(onStart).toHaveBeenCalledWith(
      expect.objectContaining({
        gameMode: GameModes.VS_FRIEND,
        opponentType: PlayerTypes.HUMAN,
        opponentName: "Rex",
      }),
    );
  });
});
