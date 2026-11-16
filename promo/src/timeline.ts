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

// Hook: start a beat before the first vanish so it lands around 1s in.
const firstVanish = event(vs, "disappear");
export const HOOK = scene(vs, 0, Math.max(0, firstVanish - 0.9), firstVanish + 1.6, 2.5);

export const PLAY = scene(
  vs,
  HOOK.frames - OVERLAP,
  Math.max(0, event(vs, "gameStart") - 0.2),
  Math.min(vs.durationSec, event(vs, "win") + 2.0),
  7.6,
);

const onlineFirstTap = online.taps[0]?.t ?? 0;
export const ONLINE = scene(
  online,
  PLAY.from + PLAY.frames - OVERLAP,
  Math.max(0, onlineFirstTap - 0.35),
  online.durationSec - 0.2,
  6.2,
);

export const END = { from: ONLINE.from + ONLINE.frames - OVERLAP, frames: Math.round(3.6 * FPS) };

export const TOTAL_FRAMES = END.from + END.frames;

export const MOMENTS = {
  playVanish: PLAY.at(event(vs, "disappear")),
  playWin: PLAY.at(event(vs, "win")),
  onlineReady: ONLINE.at(event(online, "roomReady")),
  onlineCopied: ONLINE.at(event(online, "copied")),
  onlineJoined: ONLINE.at(event(online, "joined")),
};
