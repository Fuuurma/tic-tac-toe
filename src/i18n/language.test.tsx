// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { WelcomeStep } from "@/components/onboarding/welcomeStep";
import { en, type StringKey } from "./en";
import { es } from "./es";
import { getLocale, initLocale, loadLanguage, setLocale, t } from "./language";
import { shouldShowOnboarding } from "@/lib/onboarding";

afterEach(() => {
  setLocale("en");
  vi.unstubAllGlobals();
});

describe("dictionaries", () => {
  it("covers every English key in Spanish", () => {
    const missing = (Object.keys(en) as StringKey[]).filter((k) => !(k in es));
    expect(missing).toEqual([]);
  });

  it("keeps every placeholder the English source declares", () => {
    const varsOf = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    const mismatched = (Object.keys(en) as StringKey[]).filter(
      (k) => varsOf(en[k]).join(",") !== varsOf(es[k]).join(","),
    );
    expect(mismatched).toEqual([]);
  });
});

describe("translator", () => {
  it("renders English by default", () => {
    expect(t("lobby.start")).toBe("Start Game");
  });

  it("renders Spanish after switching", () => {
    setLocale("es");
    expect(t("lobby.start")).toBe("Empezar");
  });

  it("interpolates named variables", () => {
    setLocale("es");
    expect(t("game.winsHeadline", { name: "Luz" })).toBe("¡Luz gana!");
  });
});

describe("locale state", () => {
  it("reports the switch", () => {
    expect(getLocale()).toBe("en");
    setLocale("es");
    expect(getLocale()).toBe("es");
  });

  it("persists the choice under its own key", () => {
    window.localStorage.clear();
    setLocale("es");
    expect(loadLanguage()).toBe("es");
  });

  it("does not end a first run by itself", () => {
    window.localStorage.clear();
    setLocale("es");
    expect(shouldShowOnboarding()).toBe(true);
  });

  it("sets the document language", () => {
    setLocale("es");
    expect(document.documentElement.lang).toBe("es");
  });

  it("detects a Spanish browser when nothing is saved", () => {
    window.localStorage.clear();
    vi.stubGlobal("navigator", { language: "es-ES" });
    expect(initLocale()).toBe("es");
    expect(getLocale()).toBe("es");
  });

  it("keeps English for other browsers when nothing is saved", () => {
    window.localStorage.clear();
    vi.stubGlobal("navigator", { language: "en-US" });
    expect(initLocale()).toBe("en");
  });
});

describe("one-button toggle", () => {
  it("flips the language and shows the current code", async () => {
    const { LanguageToggle } = await import("@/components/lobby/languageSwitcher");
    window.localStorage.clear();
    setLocale("en");
    render(<LanguageToggle />);
    expect(screen.getByRole("button", { name: "Switch language" }).textContent).toMatch(/EN/);

    fireEvent.click(screen.getByRole("button", { name: "Switch language" }));
    expect(screen.getByRole("button", { name: "Cambiar idioma" }).textContent).toMatch(/ES/);
    expect(loadLanguage()).toBe("es");
  });
});

describe("live switch", () => {
  it("re-renders the welcome step in Spanish and back", () => {
    window.localStorage.clear();
    setLocale("en");
    render(<WelcomeStep onStart={() => {}} onSkip={() => {}} />);
    expect(screen.getByText("Your oldest mark vanishes.")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Español" }));
    expect(screen.getByText("Tu marca más antigua desaparece.")).toBeTruthy();
    expect(screen.queryByText("Your oldest mark vanishes.")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "English" }));
    expect(screen.getByText("Your oldest mark vanishes.")).toBeTruthy();
  });
});
