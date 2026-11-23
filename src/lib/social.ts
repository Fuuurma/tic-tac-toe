import { getBrowserStorage } from "@/lib/storage";

export const REACTIONS = ["hello", "good_luck", "nice_move", "wow", "oops", "thinking", "thanks", "good_game", "well_played", "rematch"] as const;
export type Reaction = (typeof REACTIONS)[number];
export const isReaction = (value: unknown): value is Reaction => typeof value === "string" && (REACTIONS as readonly string[]).includes(value);

const MUTED_STORAGE_KEY = "tic-tac-toe:social-muted";

export function loadSocialMuted(
  storage: Storage | null = getBrowserStorage(),
): boolean {
  try {
    return storage?.getItem(MUTED_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function saveSocialMuted(
  muted: boolean,
  storage: Storage | null = getBrowserStorage(),
): void {
  try {
    storage?.setItem(MUTED_STORAGE_KEY, muted ? "1" : "0");
  } catch {
    return;
  }
}
