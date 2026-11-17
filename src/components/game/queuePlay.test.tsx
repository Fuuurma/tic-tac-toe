// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { QueueStrip, type StripInvite } from "./queuePlay";
import { COPY_FLASH_MS } from "@/game/constants";
import { setLocale } from "@/i18n/language";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

// InviteAction is internal to queuePlay.tsx; the strip's `invite` prop is the
// seam, so every case drives QueueStrip and reads what the host would see.
const INVITE: StripInvite = {
  url: "https://ttt.example/?room=FRIDAY-9",
  shareTitle: "Tic Tac Toe Disappear room",
  shareText: "Join my Tic Tac Toe Disappear room with code FRIDAY-9",
};
const DETAIL = "2 other players are looking";

function renderStrip() {
  return render(
    <QueueStrip
      phase="searching"
      detail={DETAIL}
      invite={INVITE}
      onLeave={vi.fn()}
    />,
  );
}

function stubClipboard(writeText = vi.fn().mockResolvedValue(undefined)) {
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText },
    configurable: true,
  });
  return writeText;
}

function stubShare(share = vi.fn().mockResolvedValue(undefined)) {
  Object.defineProperty(navigator, "share", {
    value: share,
    configurable: true,
  });
  return share;
}

// jsdom ships neither Web Share nor Clipboard. defineProperty shadows any
// prototype and the deletes restore the absent state between cases.
afterEach(() => {
  cleanup();
  Reflect.deleteProperty(navigator, "share");
  Reflect.deleteProperty(navigator, "clipboard");
  setLocale("en");
  vi.useRealTimers();
});

// A live region is an aria-live attribute or a role that implies one
// (status/alert/log/marquee/timer). The strip's detail line is the only one
// allowed to speak — a second announcer would double-say the copy result.
function liveRegions(container: HTMLElement) {
  return container.querySelectorAll(
    "[aria-live], [role='status'], [role='alert'], [role='log'], [role='marquee'], [role='timer']",
  );
}

describe("QueueStrip invite action", () => {
  it("hands the invite to the share sheet when navigator.share exists", () => {
    const share = stubShare();
    const writeText = stubClipboard();

    renderStrip();
    fireEvent.click(screen.getByRole("button", { name: "Share" }));

    expect(share).toHaveBeenCalledWith({
      title: INVITE.shareTitle,
      text: INVITE.shareText,
      url: INVITE.url,
    });
    expect(writeText).not.toHaveBeenCalled();
    // Sharing is its own confirmation — the strip's detail line is untouched.
    expect(screen.queryByText("Invite link copied.")).toBeNull();
  });

  it("copies the link when there is no share sheet", async () => {
    Reflect.deleteProperty(navigator, "share");
    const writeText = stubClipboard();

    renderStrip();
    fireEvent.click(screen.getByRole("button", { name: "Copy link" }));

    expect(writeText).toHaveBeenCalledWith(INVITE.url);
    await screen.findByRole("button", { name: "Copied" });
  });

  it("announces the copy in the strip's only live region", async () => {
    Reflect.deleteProperty(navigator, "share");
    stubClipboard();
    const { container } = renderStrip();

    expect(liveRegions(container)).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Copy link" }));

    await screen.findByText("Invite link copied.");
    const status = screen.getByRole("status");
    expect(within(status).getByText("Invite link copied.")).toBeTruthy();
    // The confirmation borrowed the detail line's region — it did not add one.
    expect(status).toBe(liveRegions(container)[0]);
    expect(liveRegions(container)).toHaveLength(1);
  });

  it("reports a refused copy in the same live region", async () => {
    Reflect.deleteProperty(navigator, "share");
    stubClipboard(vi.fn().mockRejectedValue(new Error("denied")));
    const { container } = renderStrip();

    fireEvent.click(screen.getByRole("button", { name: "Copy link" }));

    await screen.findByText("Couldn't copy the link.");
    const status = screen.getByRole("status");
    expect(within(status).getByText("Couldn't copy the link.")).toBeTruthy();
    expect(liveRegions(container)).toHaveLength(1);
    // No copied state on failure — the button still offers to try again.
    expect(screen.getByRole("button", { name: "Copy link" })).toBeTruthy();
  });

  it("hands the detail line back when the copy flash ends", async () => {
    vi.useFakeTimers();
    Reflect.deleteProperty(navigator, "share");
    stubClipboard();
    renderStrip();

    fireEvent.click(screen.getByRole("button", { name: "Copy link" }));
    await act(async () => {});
    expect(
      within(screen.getByRole("status")).getByText("Invite link copied."),
    ).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(COPY_FLASH_MS);
    });
    expect(
      within(screen.getByRole("status")).getByText(DETAIL),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Copy link" })).toBeTruthy();
  });
});