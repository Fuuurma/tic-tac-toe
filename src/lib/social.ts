import type { Locale } from "@/lib/preferences";

export const REACTIONS = ["hello", "good_luck", "nice_move", "wow", "oops", "thinking", "thanks", "good_game", "well_played", "rematch"] as const;
export type Reaction = (typeof REACTIONS)[number];
export const isReaction = (value: unknown): value is Reaction => typeof value === "string" && (REACTIONS as readonly string[]).includes(value);

/**
 * The visible copy for every reaction, keyed by the REACTIONS id.
 *
 * These tables used to be index-parallel arrays that lived in the
 * component that renders them: an id added to REACTIONS without a
 * matching entry rendered "undefined undefined" and no type error said
 * so. Keying them by id makes a missing entry a compile error — the
 * records below are exhaustive over REACTIONS — and the coverage test in
 * social.test.ts keeps it a runtime one too.
 */
export const REACTION_LABELS = {
  en: { hello: "Hello!", good_luck: "Good luck!", nice_move: "Nice move!", wow: "Wow!", oops: "Oops!", thinking: "Thinking…", thanks: "Thanks!", good_game: "Good game!", well_played: "Well played!", rematch: "Rematch?" },
  es: { hello: "¡Hola!", good_luck: "¡Buena suerte!", nice_move: "¡Buena jugada!", wow: "¡Guau!", oops: "¡Ups!", thinking: "Pensando…", thanks: "¡Gracias!", good_game: "¡Buena partida!", well_played: "¡Bien jugado!", rematch: "¿Revancha?" },
} satisfies Record<Locale, Record<Reaction, string>>;

/** The emoji is the same in every locale, so it lives in one table. */
export const REACTION_ICONS = {
  hello: "👋", good_luck: "🍀", nice_move: "👏", wow: "😮", oops: "😅", thinking: "🤔", thanks: "🙏", good_game: "🤝", well_played: "✨", rematch: "🔄",
} satisfies Record<Reaction, string>;
