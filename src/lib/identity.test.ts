import { describe, expect, it, beforeEach } from "vitest";
import {
  generateGuestDisplayName,
  getOrCreateGuestIdentity,
  IDENTITY_STORAGE_KEYS,
  sanitizeDisplayName,
  saveDisplayName,
} from "@/lib/identity";

class MockStorage implements Storage {
  private data = new Map<string, string>();
  get length(): number {
    return this.data.size;
  }
  clear(): void {
    this.data.clear();
  }
  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }
  key(): string | null {
    return null;
  }
  removeItem(key: string): void {
    this.data.delete(key);
  }
  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }
}

describe("sanitizeDisplayName", () => {
  it("returns a fallback for short or empty input", () => {
    expect(sanitizeDisplayName("")).toMatch(/^(Guest|Player|Tactician)-\d{4}$/);
    expect(sanitizeDisplayName("a")).toMatch(/^(Guest|Player|Tactician)-\d{4}$/);
  });

  it("strips control characters and limits length", () => {
    expect(sanitizeDisplayName("Al\u0000ice<>")).toBe("Alice");
    expect(sanitizeDisplayName("x".repeat(50))).toHaveLength(20);
  });

  it("trims and collapses internal whitespace to single spaces", () => {
    expect(sanitizeDisplayName("  Alice   Bob  ")).toBe("Alice Bob");
  });
});

describe("generateGuestDisplayName", () => {
  it("returns a Guest-#### style name", () => {
    const name = generateGuestDisplayName();
    expect(name).toMatch(/^(Guest|Player|Tactician)-\d{4}$/);
  });
});

describe("getOrCreateGuestIdentity", () => {
  let storage: MockStorage;
  beforeEach(() => {
    storage = new MockStorage();
  });

  it("creates a guest id and stores it on first call", () => {
    const identity = getOrCreateGuestIdentity(storage);
    expect(identity.guestId).toMatch(/^guest:/);
    expect(storage.getItem(IDENTITY_STORAGE_KEYS.guestId)).toBe(identity.guestId);
  });

  it("reuses an existing guest id", () => {
    const first = getOrCreateGuestIdentity(storage);
    const second = getOrCreateGuestIdentity(storage);
    expect(second.guestId).toBe(first.guestId);
  });
});

describe("saveDisplayName", () => {
  let storage: MockStorage;
  beforeEach(() => {
    storage = new MockStorage();
  });

  it("persists the sanitized display name and preserves the guest id", () => {
    const identity = getOrCreateGuestIdentity(storage);
    const updated = saveDisplayName("Alice", storage);
    expect(updated.displayName).toBe("Alice");
    expect(updated.guestId).toBe(identity.guestId);
    expect(storage.getItem(IDENTITY_STORAGE_KEYS.displayName)).toBe("Alice");
  });
});
