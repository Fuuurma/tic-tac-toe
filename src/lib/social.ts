export const REACTIONS = ["hello", "good_luck", "nice_move", "wow", "oops", "thinking", "thanks", "good_game", "well_played", "rematch"] as const;
export type Reaction = (typeof REACTIONS)[number];
export const isReaction = (value: unknown): value is Reaction => typeof value === "string" && (REACTIONS as readonly string[]).includes(value);
