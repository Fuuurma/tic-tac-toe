// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { setLocale } from "@/i18n/language";
import { SocialReactions } from "./socialReactions";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

afterEach(() => {
  cleanup();
  setLocale("en");
});

const noopSend = () => true;

/**
 * The visible copy, pinned as literals so the expectation is not
 * recomputed from the table it checks. The order is the picker's order,
 * which is the REACTIONS order.
 */
const PICKER_EN = [
  "👋 Hello!",
  "🍀 Good luck!",
  "👏 Nice move!",
  "😮 Wow!",
  "😅 Oops!",
  "🤔 Thinking…",
  "🙏 Thanks!",
  "🤝 Good game!",
  "✨ Well played!",
  "🔄 Rematch?",
];

const PICKER_ES = [
  "👋 ¡Hola!",
  "🍀 ¡Buena suerte!",
  "👏 ¡Buena jugada!",
  "😮 ¡Guau!",
  "😅 ¡Ups!",
  "🤔 Pensando…",
  "🙏 ¡Gracias!",
  "🤝 ¡Buena partida!",
  "✨ ¡Bien jugado!",
  "🔄 ¿Revancha?",
];

describe("SocialReactions picker", () => {
  it("shows every reaction's icon and label, in REACTIONS order", () => {
    const { container } = render(
      <SocialReactions ready reaction={null} send={noopSend} />,
    );
    const items = [...container.querySelectorAll("details button")].map(
      (button) => button.textContent?.trim(),
    );
    expect(items).toEqual(PICKER_EN);
  });

  it("shows the Spanish copy when the locale is Spanish", () => {
    setLocale("es");
    const { container } = render(
      <SocialReactions ready reaction={null} send={noopSend} />,
    );
    const items = [...container.querySelectorAll("details button")].map(
      (button) => button.textContent?.trim(),
    );
    expect(items).toEqual(PICKER_ES);
  });

  it("shows the received reaction's icon and label in the status line", async () => {
    render(
      <SocialReactions
        ready
        reaction={{ id: "nice_move", at: Date.now() }}
        send={noopSend}
      />,
    );
    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toBe("👏 Nice move!"),
    );
  });
});
