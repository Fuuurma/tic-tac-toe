import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { InstallState } from "@/lib/installPrompt";
import { setLocale } from "@/i18n/language";
import { PreferencesSheet } from "./preferencesSheet";

const installState = vi.hoisted(() => ({
  current: "unavailable" as InstallState,
}));

vi.mock("@/lib/installPrompt", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/installPrompt")>();
  return {
    ...actual,
    useInstallPrompt: () => ({
      state: installState.current,
      promptInstall: () => Promise.resolve(false),
    }),
  };
});

const IPHONE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const IPAD_UA =
  "Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const DESKTOP_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15";
const ANDROID_UA =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36";

const useUa = (userAgent: string, platform = "", maxTouchPoints = 0) => {
  vi.stubGlobal("navigator", { userAgent, platform, maxTouchPoints });
};

const renderSettings = () =>
  renderToStaticMarkup(
    <PreferencesSheet isOpen onClose={vi.fn()} onHowToPlay={vi.fn()} />,
  );

const hasExactLabel = (html: string, text: string) =>
  html.includes(`>${text}</span>`);

const stepCount = (html: string) => html.match(/<li>/g)?.length ?? 0;

describe("iOS install guidance", () => {
  afterEach(() => {
    installState.current = "unavailable";
    setLocale("en");
    vi.unstubAllGlobals();
  });

  it("shows Share-sheet steps on iPhone when no prompt is offered", () => {
    useUa(IPHONE_UA);
    const html = renderSettings();

    expect(hasExactLabel(html, "Add to Home Screen")).toBe(true);
    expect(stepCount(html)).toBe(3);
    expect(html).toContain("Tap the Share button in Safari.");
    expect(html).not.toContain("Install app");
  });

  it("shows the same guidance on iPad", () => {
    useUa(IPAD_UA);
    const html = renderSettings();

    expect(hasExactLabel(html, "Add to Home Screen")).toBe(true);
    expect(html).toContain("<ol");
    expect(html).not.toContain("Install app");
  });

  it("treats an iPad reporting a desktop UA as iOS", () => {
    useUa(DESKTOP_UA, "MacIntel", 5);
    const html = renderSettings();

    expect(hasExactLabel(html, "Add to Home Screen")).toBe(true);
  });

  it("keeps the native install row when the browser offers a prompt", () => {
    installState.current = "available";
    const html = renderSettings();

    expect(html).toContain("Install app");
    expect(html).not.toContain("<ol");
  });

  it("renders no install row once installed, even on iOS", () => {
    useUa(IPHONE_UA);
    installState.current = "installed";
    const html = renderSettings();

    expect(html).not.toContain("Install app");
    expect(html).not.toContain("<ol");
    expect(hasExactLabel(html, "Add to Home Screen")).toBe(false);
  });

  it("renders nothing on Android or desktop without an offer", () => {
    useUa(ANDROID_UA);
    const android = renderSettings();
    useUa(DESKTOP_UA);
    const desktop = renderSettings();

    for (const html of [android, desktop]) {
      expect(html).not.toContain("Install app");
      expect(html).not.toContain("<ol");
    }
  });

  it("hides the guidance when the app already runs as an installed standalone", () => {
    useUa(IPHONE_UA);
    vi.stubGlobal("window", {
      matchMedia: (query: string) => ({ matches: query.includes("standalone") }),
    });
    const html = renderSettings();

    expect(html).not.toContain("<ol");
    expect(hasExactLabel(html, "Add to Home Screen")).toBe(false);
    expect(html).not.toContain("Install app");
  });

  it("renders the guidance in Spanish when the locale is es", () => {
    useUa(IPHONE_UA);
    setLocale("es");
    const html = renderSettings();

    expect(hasExactLabel(html, "Añadir a pantalla de inicio")).toBe(true);
    expect(html).toContain("Toca el botón Compartir en Safari.");
  });
});
