// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { LobbyForm } from "./lobbyForm";
import { isNpcName } from "@/game/npc-names";

// The opponent summary card shows the name, then the "(Easy)" style badge.
function opponentCardName(): string {
  const card = screen.getByRole("button", { name: "Edit opponent settings" });
  return (card.textContent ?? "").split("(")[0]!.trim();
}

afterEach(cleanup);

describe("LobbyForm computer opponent naming", () => {
  it("greets a fresh visitor with a roster persona, not the bare AI label", () => {
    render(<LobbyForm onStart={vi.fn()} />);

    const name = opponentCardName();
    expect(isNpcName(name)).toBe(true);
  });

  it("draws a different persona when Computer mode is re-entered", () => {
    render(<LobbyForm onStart={vi.fn()} />);

    const first = opponentCardName();
    expect(isNpcName(first)).toBe(true);

    fireEvent.click(screen.getByRole("radio", { name: "vs Friend" }));
    fireEvent.click(screen.getByRole("radio", { name: "vs Computer" }));

    const second = opponentCardName();
    expect(isNpcName(second)).toBe(true);
    expect(second).not.toBe(first);
  });

  it("keeps a saved opponent name instead of a persona", () => {
    window.localStorage.setItem(
      "tic-tac-toe:preferences",
      JSON.stringify({ opponentName: "Zed" }),
    );
    render(<LobbyForm onStart={vi.fn()} />);

    expect(opponentCardName()).toBe("Zed");
  });
});
