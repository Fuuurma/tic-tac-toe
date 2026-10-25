// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { LobbyForm } from "./lobbyForm";

afterEach(cleanup);

describe("LobbyForm online options", () => {
  it("keeps Create Room enabled and sends Quick Match users there", () => {
    render(<LobbyForm onStart={vi.fn()} />);
    fireEvent.click(screen.getByRole("radio", { name: "Online" }));

    fireEvent.click(screen.getByRole("radio", { name: "Create" }));
    expect((screen.getByRole("button", { name: "Create Room" }) as HTMLButtonElement).disabled).toBe(false);

    fireEvent.click(screen.getByRole("radio", { name: "Quick" }));
    const quick = screen.getByRole("button", { name: "Quick Match" }) as HTMLButtonElement;
    expect(quick.disabled).toBe(true);
    const reasonId = quick.getAttribute("aria-describedby");
    expect(reasonId && document.getElementById(reasonId)?.textContent).toBe(
      "Online play isn't available in this build. Create or join a room instead.",
    );
  });
});