// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The sound module keeps a module-level AudioContext singleton, so every
 * case reloads it fresh (vi.resetModules + dynamic import) with a stubbed
 * AudioContext whose nodes record what the recipes schedule.
 */

interface FakeParam {
  setValueAtTime: ReturnType<typeof vi.fn>;
  exponentialRampToValueAtTime: ReturnType<typeof vi.fn>;
}

interface FakeOsc {
  type: string;
  frequency: FakeParam;
  connect: ReturnType<typeof vi.fn>;
  start: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
}

interface FakeGain {
  gain: FakeParam;
  connect: ReturnType<typeof vi.fn>;
}

function makeFakeContext(state: "running" | "suspended" = "running") {
  const oscillators: FakeOsc[] = [];
  const gains: FakeGain[] = [];
  const ctx = {
    state,
    currentTime: 1.5,
    destination: {},
    resume: vi.fn(() => {
      ctx.state = "running";
      return Promise.resolve();
    }),
    createOscillator: vi.fn(() => {
      const osc: FakeOsc = {
        type: "",
        frequency: {
          setValueAtTime: vi.fn(),
          exponentialRampToValueAtTime: vi.fn(),
        },
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
      };
      oscillators.push(osc);
      return osc;
    }),
    createGain: vi.fn(() => {
      const gain: FakeGain = {
        gain: {
          setValueAtTime: vi.fn(),
          exponentialRampToValueAtTime: vi.fn(),
        },
        connect: vi.fn(),
      };
      gains.push(gain);
      return gain;
    }),
  };
  return { ctx, oscillators, gains };
}

async function loadSound(
  fake?: ReturnType<typeof makeFakeContext>["ctx"],
  hasAudioContext = true,
) {
  vi.resetModules();
  if (hasAudioContext && fake) {
    vi.stubGlobal(
      "AudioContext",
      vi.fn(function AudioContext() {
        return fake;
      }),
    );
  } else {
    vi.stubGlobal("AudioContext", undefined);
    // @ts-expect-error jsdom has no webkitAudioContext; ensure the fallback misses too
    window.webkitAudioContext = undefined;
  }
  return await import("./sound");
}

beforeEach(() => {
  window.localStorage.clear();
});

describe("sound mute preference", () => {
  it("is unmuted by default", async () => {
    const sound = await loadSound();
    expect(sound.isSoundMuted()).toBe(false);
  });

  it("persists the mute flag through the preferences blob", async () => {
    const sound = await loadSound();
    sound.setSoundMuted(true);
    expect(sound.isSoundMuted()).toBe(true);
    // A fresh module read sees the same flag — one source of truth.
    const again = await loadSound();
    expect(again.isSoundMuted()).toBe(true);
    again.setSoundMuted(false);
    expect(again.isSoundMuted()).toBe(false);
  });
});

describe("playSound", () => {
  it("schedules one enveloped tone for a place cue on a running context", async () => {
    const { ctx, oscillators, gains } = makeFakeContext();
    const sound = await loadSound(ctx);

    sound.playSound("place");

    expect(oscillators).toHaveLength(1);
    expect(oscillators[0].start).toHaveBeenCalledTimes(1);
    expect(oscillators[0].stop).toHaveBeenCalledTimes(1);
    expect(gains).toHaveLength(1);
    // Fast attack then decay to silence — no click at either edge.
    expect(gains[0].gain.setValueAtTime).toHaveBeenCalledWith(0.0001, 1.5);
    expect(gains[0].gain.exponentialRampToValueAtTime).toHaveBeenCalled();
  });

  it("voices the win cue as a three-note rise", async () => {
    const { ctx, oscillators } = makeFakeContext();
    const sound = await loadSound(ctx);

    sound.playSound("win");

    expect(oscillators).toHaveLength(3);
    const freqs = oscillators.map((o) => o.frequency.setValueAtTime.mock.calls[0][0]);
    expect(freqs[0]).toBeLessThan(freqs[1]);
    expect(freqs[1]).toBeLessThan(freqs[2]);
    // Staggered onsets: each note starts later than the last.
    const onsets = oscillators.map((o) => o.frequency.setValueAtTime.mock.calls[0][1]);
    expect(onsets[0]).toBeLessThan(onsets[1]);
    expect(onsets[1]).toBeLessThan(onsets[2]);
  });

  it("shifts the whole cue by delaySeconds", async () => {
    const { ctx, oscillators } = makeFakeContext();
    const sound = await loadSound(ctx);

    sound.playSound("turn", 0.16);

    // currentTime is 1.5 in the fake; the delayed cue lands at 1.66.
    expect(oscillators[0].frequency.setValueAtTime).toHaveBeenCalledWith(840, 1.66);
  });

  it("schedules nothing while muted", async () => {
    const { ctx, oscillators } = makeFakeContext();
    const sound = await loadSound(ctx);
    sound.setSoundMuted(true);

    sound.playSound("place");
    sound.playSound("win");

    expect(oscillators).toHaveLength(0);
  });

  it("resumes a suspended context instead of queueing a burst", async () => {
    const { ctx, oscillators } = makeFakeContext("suspended");
    const sound = await loadSound(ctx);

    sound.playSound("place");

    expect(ctx.resume).toHaveBeenCalledTimes(1);
    expect(oscillators).toHaveLength(0);
  });

  it("plays on the next cue once the context is running", async () => {
    const { ctx, oscillators } = makeFakeContext("suspended");
    const sound = await loadSound(ctx);

    sound.playSound("place"); // suspended: resume only
    expect(oscillators).toHaveLength(0);

    // resume() flips the fake to running; the next cue sounds.
    sound.playSound("place");
    expect(oscillators).toHaveLength(1);
  });

  it("is a silent no-op where WebAudio does not exist", async () => {
    const sound = await loadSound(undefined, false);
    expect(() => sound.playSound("win")).not.toThrow();
  });
});

describe("armSoundUnlock", () => {
  it("resumes the context on the first pointer gesture and disarms", async () => {
    const { ctx } = makeFakeContext("suspended");
    const sound = await loadSound(ctx);

    sound.armSoundUnlock();
    window.dispatchEvent(new Event("pointerdown"));

    expect(ctx.resume).toHaveBeenCalledTimes(1);
    // A second gesture after running finds the listeners gone.
    ctx.state = "running";
    window.dispatchEvent(new Event("pointerdown"));
    expect(ctx.resume).toHaveBeenCalledTimes(1);
  });

  it("arms only once across calls and surfaces", async () => {
    const { ctx } = makeFakeContext("suspended");
    const sound = await loadSound(ctx);

    sound.armSoundUnlock();
    sound.armSoundUnlock();
    window.dispatchEvent(new Event("keydown"));

    expect(ctx.resume).toHaveBeenCalledTimes(1);
  });
});
