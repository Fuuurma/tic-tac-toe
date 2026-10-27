/**
 * The selectable-tile recipe: one control, two weights, two states.
 *
 * Every radio/option tile in the app — AI difficulty, player type, queue
 * warm-up, the settings tabs, the symbol picker, the two large mode choices —
 * is the same affordance, and each site wrote the class list out by hand. They
 * had drifted four ways in the selected state and three in the unselected one,
 * so "the same" control rendered differently depending on which screen it was
 * on: two settings tabs were missing the ring their own siblings had.
 *
 * Two weights, because the app really does use two:
 *
 * - `compact` (default) — a chip in a row: 0.1 tint, shadow-sm, a 1px ring.
 * - `strong` — a large primary choice (game mode, how to go online): 0.15
 *   tint, shadow-md, a 2px ring at 0.35. These sit alone above the fold and
 *   carry more visual weight on purpose.
 *
 * A site that needs something extra on top (the symbol picker adds a heavier
 * ring on phones) composes it on top with `cn(pickerTileClass(selected), …)`
 * rather than forking the recipe.
 *
 * Not every disclosure is a tile: `pickerDisclosure` uses `border-primary` and
 * is a *trigger* that opens a picker, not a selectable option — leave it out.
 *
 * `gameModeSelector` is the other deliberate exception. Its SELECTED state is
 * identical to `strong` above, but its unselected state is a card surface
 * (`border-foreground/15 bg-card/70`, with its own dark variants) because the
 * mode tiles sit on the lobby card rather than a glass sheet. Two states that
 * differ by surface are not one recipe; forcing it in would mean passing a
 * surface flag for a single caller.
 */
export type PickerWeight = "compact" | "strong";

const SELECTED: Record<PickerWeight, string> = {
  compact:
    "border-[rgb(var(--player-color))] bg-[rgb(var(--player-color)/0.1)] text-foreground shadow-sm ring-1 ring-[rgb(var(--player-color)/0.2)]",
  strong:
    "border-[rgb(var(--player-color))] bg-[rgb(var(--player-color)/0.15)] text-foreground shadow-md ring-2 ring-[rgb(var(--player-color)/0.35)]",
};

const UNSELECTED =
  "border-border/70 bg-background/50 text-muted-foreground hover:border-[rgb(var(--player-color)/0.4)] hover:bg-muted/60 hover:text-foreground";

export function pickerTileClass(
  selected: boolean,
  weight: PickerWeight = "compact",
): string {
  return selected ? SELECTED[weight] : UNSELECTED;
}
