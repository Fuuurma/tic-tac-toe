"@vitest-environment jsdom";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";
import { resetDocumentHiddenStore, useDocumentHidden } from "./useDocumentHidden";

function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    value: state,
  });
  document.dispatchEvent(new Event("visibilitychange"));
}

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
    true;
  setVisibility("visible");
});

afterEach(() => {
  cleanup();
  resetDocumentHiddenStore();
  setVisibility("visible");
  delete (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean })
    .IS_REACT_ACT_ENVIRONMENT;
});

describe("useDocumentHidden", () => {
  it("reports the document as visible by default", () => {
    const { result } = renderHook(() => useDocumentHidden());

    expect(result.current).toBe(false);
  });

  it("reads hidden when the tab is already hidden at subscribe time", () => {
    setVisibility("hidden");

    const { result } = renderHook(() => useDocumentHidden());

    expect(result.current).toBe(true);
  });

  it("flips on visibilitychange in both directions", () => {
    const { result } = renderHook(() => useDocumentHidden());

    act(() => setVisibility("hidden"));
    expect(result.current).toBe(true);

    act(() => setVisibility("visible"));
    expect(result.current).toBe(false);
  });

  it("removes the document listener when the last subscriber unmounts", () => {
    const add = vi.spyOn(document, "addEventListener");
    const remove = vi.spyOn(document, "removeEventListener");

    const { unmount } = renderHook(() => useDocumentHidden());
    unmount();

    const added = add.mock.calls
      .filter(([type]) => type === "visibilitychange")
      .map(([, listener]) => listener);
    const removed = remove.mock.calls
      .filter(([type]) => type === "visibilitychange")
      .map(([, listener]) => listener);

    expect(added).toHaveLength(1);
    expect(removed).toEqual(added);

    add.mockRestore();
    remove.mockRestore();
  });
});
