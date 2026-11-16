import { loadPreferences, savePreferences } from "@/lib/preferences";

/**
 * The game's entire sound palette, synthesised at runtime — no audio assets,
 * so the bundle budget stays flat and there is nothing to preload.
 *
 * Four cues, all short and quiet: a mark lands (`place`), a mark retires
 * (`vanish`), the turn passes to a human (`turn`), and someone wins (`win`).
 * WebAudio is gesture-gated by the browser: the context is created lazily
 * and resumed on the first pointer/key interaction (`armSoundUnlock`, wired
 * by useGameSounds), and `playSound` itself refuses to schedule while the
 * context is still suspended so a queued blip can never burst on resume.
 *
 * The mute flag lives in the preferences blob (`soundMuted`), the same store
 * the Settings sheet already owns — one source of truth, read fresh on every
 * cue so toggling mid-game takes effect on the next sound.
 */

export type SoundEvent = "place" | "vanish" | "turn" | "win";

export function isSoundMuted(): boolean {
  return loadPreferences().soundMuted === true;
}

export function setSoundMuted(muted: boolean): void {
  savePreferences({ soundMuted: muted });
}

type AudioContextLike = AudioContext;

let sharedContext: AudioContextLike | null = null;
let unlockArmed = false;

function audioContext(): AudioContextLike | null {
  if (typeof window === "undefined") return null;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!sharedContext) sharedContext = new Ctor();
  return sharedContext;
}

/**
 * Browsers only let audio start after a user gesture. Install once, on the
 * first pointer or key interaction anywhere in the app, a resume attempt;
 * the listeners remove themselves once the context is running. Sounds that
 * fire before any gesture simply stay silent — that is the policy working,
 * not a bug.
 */
export function armSoundUnlock(): void {
  if (unlockArmed || typeof window === "undefined") return;
  unlockArmed = true;
  const unlock = () => {
    const ctx = audioContext();
    if (!ctx) return;
    if (ctx.state === "running") {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      return;
    }
    if (ctx.state === "suspended" || ctx.state === "interrupted") {
      void ctx.resume();
    }
  };
  window.addEventListener("pointerdown", unlock, { passive: true });
  window.addEventListener("keydown", unlock);
}

interface ToneSpec {
  /** Start frequency in Hz. */
  freq: number;
  /** Optional glide target; omit for a flat tone. */
  endFreq?: number;
  /** Oscillator waveform. */
  type: OscillatorType;
  /** Duration in seconds. */
  dur: number;
  /** Peak gain — kept low; these are cues, not alarms. */
  vol: number;
}

function tone(ctx: AudioContextLike, at: number, spec: ToneSpec): void {
  const t0 = ctx.currentTime + at;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = spec.type;
  osc.frequency.setValueAtTime(spec.freq, t0);
  if (spec.endFreq !== undefined) {
    osc.frequency.exponentialRampToValueAtTime(spec.endFreq, t0 + spec.dur);
  }
  // Fast attack, exponential decay to silence: no click at either edge.
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(spec.vol, t0 + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + spec.dur);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + spec.dur + 0.05);
}

/** `at` is the caller's offset, so a cue can sit a beat behind another. */
const RECIPES: Record<SoundEvent, (ctx: AudioContextLike, at: number) => void> = {
  // A soft "tok": the mark arriving.
  place: (ctx, at) =>
    tone(ctx, at, { freq: 500, endFreq: 660, type: "triangle", dur: 0.09, vol: 0.05 }),
  // A lower, slower "poof": the oldest mark retiring.
  vanish: (ctx, at) =>
    tone(ctx, at, { freq: 340, endFreq: 190, type: "sine", dur: 0.14, vol: 0.045 }),
  // A quiet high tick: the turn is yours.
  turn: (ctx, at) =>
    tone(ctx, at, { freq: 840, type: "sine", dur: 0.055, vol: 0.032 }),
  // A rising C-major triad — the only cue allowed to be musical.
  win: (ctx, at) => {
    tone(ctx, at, { freq: 523.25, type: "triangle", dur: 0.16, vol: 0.05 });
    tone(ctx, at + 0.09, { freq: 659.25, type: "triangle", dur: 0.16, vol: 0.05 });
    tone(ctx, at + 0.18, { freq: 783.99, type: "triangle", dur: 0.22, vol: 0.055 });
  },
};

/**
 * Play one cue, optionally `delaySeconds` behind the call so consecutive
 * cues in one game beat do not smear together. No-ops when muted, when
 * WebAudio is unavailable, and while the context has not been unlocked by a
 * gesture yet — in that case it also kicks `resume()` so the NEXT cue
 * (usually right after the player's tap) can sound.
 */
export function playSound(event: SoundEvent, delaySeconds = 0): void {
  if (isSoundMuted()) return;
  const ctx = audioContext();
  if (!ctx) return;
  if (ctx.state !== "running") {
    if (ctx.state === "suspended" || ctx.state === "interrupted") void ctx.resume();
    return;
  }
  RECIPES[event](ctx, delaySeconds);
}
