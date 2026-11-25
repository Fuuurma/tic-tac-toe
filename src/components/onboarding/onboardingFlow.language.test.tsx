"@vitest-environment jsdom";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Color, SymbolShape } from "@/game/constants";
import { setLocale } from "@/i18n/language";
import { IDENTITY_STORAGE_KEYS } from "@/lib/identity";
import { ONBOARDING_STORAGE_KEY } from "@/lib/onboarding";
import { OnboardingFlow } from "./onboardingFlow";

const guestNameGenerations = vi.hoisted(() => ({ count: 0 }));
const guestIdentityReads = vi.hoisted(() => ({ displayName: "" }));

vi.mock("@/lib/identity", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/identity")>();
  return {
    ...actual,
    generateGuestDisplayName: (
      ...args: Parameters<typeof actual.generateGuestDisplayName>
    ) => {
      guestNameGenerations.count += 1;
      return actual.generateGuestDisplayName(...args);
    },
    getOrCreateGuestIdentity: (
      ...args: Parameters<typeof actual.getOrCreateGuestIdentity>
    ) => {
      const identity = actual.getOrCreateGuestIdentity(...args);
      guestIdentityReads.displayName = identity.displayName;
      return identity;
    },
  };
});

beforeEach(() => {
  window.localStorage.clear();
  setLocale("en");
  guestNameGenerations.count = 0;
  guestIdentityReads.displayName = "";
  vi.spyOn(Math, "random").mockReturnValue(0);
});

afterEach(() => {
  cleanup();
  setLocale("en");
  vi.restoreAllMocks();
});

const storedName = () => window.localStorage.getItem(IDENTITY_STORAGE_KEYS.displayName);
const storedOutcome = () => window.localStorage.getItem(ONBOARDING_STORAGE_KEY);

describe("first-run suggested name", () => {
  it("comes from the English pools while English is selected", () => {
    render(<OnboardingFlow mode="first-run" onExit={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Get started" }));

    expect((screen.getByLabelText("Your name") as HTMLInputElement).value).toBe("Crimson Fox");
    expect(guestNameGenerations.count).toBe(1);
  });

  it("comes from the Spanish pools after choosing Español on welcome", () => {
    render(<OnboardingFlow mode="first-run" onExit={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Español" }));
    fireEvent.click(screen.getByRole("button", { name: "Empezar" }));

    const name = (screen.getByLabelText("Tu nombre") as HTMLInputElement).value;
    expect(name).toBe("Veloz Rayo");
    expect(guestNameGenerations.count).toBe(1);

    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    expect(storedName()).toBe("Veloz Rayo");
  });
});

describe("replay", () => {
  it("keeps the saved identity even with Spanish selected", () => {
    window.localStorage.setItem(IDENTITY_STORAGE_KEYS.displayName, "Maria");
    window.localStorage.setItem(
      "tic-tac-toe:preferences",
      JSON.stringify({ color: Color.PINK, playerShape: SymbolShape.HEART }),
    );
    setLocale("es");
    const onExit = vi.fn();
    render(<OnboardingFlow mode="replay" onExit={onExit} />);

    expect(screen.getByRole("group", { name: "Tablero de tres en raya" })).toBeTruthy();
    expect(guestIdentityReads.displayName).toBe("Maria");
    expect(storedName()).toBe("Maria");

    fireEvent.click(screen.getByRole("button", { name: "Omitir" }));

    expect(onExit).toHaveBeenCalledTimes(1);
    expect(storedOutcome()).toBeNull();
    expect(storedName()).toBe("Maria");
  });
});
