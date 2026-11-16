import vsComputer from "../public/captures/vs-computer.json";
import onlineInvite from "../public/captures/online-invite.json";

/**
 * Scene timing, derived from the capture logs so a re-capture re-times the
 * cut instead of leaving captions pointing at moments that moved.
 */
export const FPS = 30;

export interface ClipMeta {
  clip: string;
  durationSec: number;
  events: { name: string; t: number }[];
  taps: { t: number; x: number; y: number }[];
}

export interface Scene {
  clip: ClipMeta;
  from: number; // output frame the scene starts on
  frames: number;
  srcStart: number; // seconds into the clip
  rate: number;
  /** Output frame (relative to the scene) of a clip moment. */
  at: (srcSec: number) => number;
}

const event = (clip: ClipMeta, name: string, nth = 0): number => {
  const hits = clip.events.filter((e) => e.name === name);
  const hit = hits[nth] ?? hits.at(-1);
  if (!hit) throw new Error(`${clip.clip}: no "${name}" event`);
  return hit.t;
};

/** Crossfade between scenes. */
export const OVERLAP = 8;

function scene(clip: ClipMeta, from: number, srcStart: number, srcEnd: number, maxSec: number): Scene {
  const srcLen = srcEnd - srcStart;
  const rate = Math.max(1, srcLen / maxSec);
  const frames = Math.round((srcLen / rate) * FPS);
  return { clip, from, frames, srcStart, rate, at: (s) => Math.round(((s - srcStart) / rate) * FPS) };
}

const vs = vsComputer as ClipMeta;
const online = onlineInvite as ClipMeta;

// Hook: start a beat before the first vanish so it lands around 1s in, and
// cut before the winning move so the gameplay scene keeps its payoff.
const firstVanish = event(vs, "disappear");
const winTap = vs.taps.filter((t) => t.t <= event(vs, "win")).at(-1)?.t ?? event(vs, "win");
export const HOOK = scene(vs, 0, Math.max(0, firstVanish - 1.0), Math.min(firstVanish + 1.5, winTap - 0.15), 2.5);

export const PLAY = scene(
  vs,
  HOOK.frames - OVERLAP,
  event(vs, "gameStart"), // the board is up; no flash of the lobby
  Math.min(vs.durationSec, event(vs, "win") + 2.0),
  8.4,
);

const onlineFirstTap = online.taps[0]?.t ?? 0;
export const ONLINE = scene(
  online,
  PLAY.from + PLAY.frames - OVERLAP,
  Math.max(0, onlineFirstTap - 0.35),
  online.durationSec - 0.2,
  7.0,
);

export const END = { from: ONLINE.from + ONLINE.frames - OVERLAP, frames: Math.round(3.6 * FPS) };

export const TOTAL_FRAMES = END.from + END.frames;

/**
 * Where the online camera looks, in clip seconds and screen fractions: each
 * tap, then the room card once it is up, then the board once the friend is in.
 */
export const ONLINE_FOCUS = [
  ...online.taps.map(({ t, y }) => ({ t, y })),
  { t: event(online, "roomReady"), y: 0.42 },
  { t: event(online, "joined"), y: 0.57 },
].sort((a, b) => a.t - b.t);

export const MOMENTS = {
  playVanish: PLAY.at(event(vs, "disappear")),
  playWin: PLAY.at(event(vs, "win")),
  onlineReady: ONLINE.at(event(online, "roomReady")),
  onlineJoined: ONLINE.at(event(online, "joined")),
};
