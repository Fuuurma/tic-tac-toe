// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { LobbyForm } from "./lobbyForm";

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