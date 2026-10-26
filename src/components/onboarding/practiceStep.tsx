import { useMemo } from "react";
import {
  COLOR_RGB,
  GAME_RULES,
  PlayerSymbol,
  type Color,
} from "@/game/constants";
import type { LessonStage } from "@/game/tutorial";
import { Button } from "@/components/ui/button";
import { Board } from "@/components/game/board";
import { useTutorialGame } from "@/hooks/useTutorialGame";
import { cn } from "@/lib/utils";
import type { Profile } from "./profileStep";
import { ctaStyle } from "./ctaStyle";
import { StepShell } from "./stepShell";

interface Coach {
  title: string;
  body: string;
}

/**
 * What the guide says, by where the lesson stands. The board does the
 * teaching (the blink, the fade); these lines only name what just happened,
 * so each stays to one idea.
 */
function coachFor(stage: LessonStage, placed: number, hasHint: boolean): Coach {
  switch (stage) {
    case "place":
      if (placed === 0) {
        return { title: "Place your first mark", body: "Tap any square. You play first, then the AI answers." };
      }
      if (placed === 1) {
        return { title: "Now a second mark", body: "Everyone keeps up to three marks on the board." };
      }
      return { title: "And a third", body: "Three is the limit. See what happens when you go past it." };
    case "limit":
      return {
        title: "Your oldest mark is blinking",
        body: "Marks about to vanish blink, yours and the AI's. Place a fourth and watch yours go.",
      };
    case "vanished":
      return {
        title: "It vanished",
        body: "You never run out of room, but nothing stays forever. Your opponent's oldest mark vanishes too.",
      };
    case "win":
      return {
        title: "Now line up three",
        body: hasHint
          ? "The glowing square wins the round."
          : "Get three in a row, column or diagonal. Your oldest mark keeps vanishing, so plan ahead.",
      };
    case "won":
      return {
        title: "Three in a row. You win!",
        body: "That is the whole game. Every turn, think about which mark leaves next.",
      };
  }
}

/** How many of the player's three marks are on the board. */
function MarkMeter({ used, color }: { used: number; color: Color }) {
  const max = GAME_RULES.MAX_MOVES_PER_PLAYER;
  return (
    <div
      role="img"
      aria-label={`Marks on board: ${used} of ${max}`}
      className="flex shrink-0 flex-col items-center gap-1.5"
      style={{ "--player-color": COLOR_RGB[color] } as React.CSSProperties}
    >
      <div className="flex gap-1.5">
        {Array.from({ length: max }, (_, i) => (
          <span
            key={i}
            className={cn(
              "size-3 rounded-sm border-2 border-[rgb(var(--player-color))] transition-colors duration-200",
              i < used ? "bg-[rgb(var(--player-color))]" : "bg-transparent",
              // The oldest mark is the one that goes next.
              used === max && i === 0 && "animate-pulse-slow",
            )}
          />
        ))}
      </div>
      <span aria-hidden="true" className="text-xs font-medium text-muted-foreground">
        On board
      </span>
    </div>
  );
}

export function PracticeStep({
  profile,
  replay,
  onSkip,
  onComplete,
}: {
  profile: Profile;
  replay: boolean;
  onSkip: () => void;
  onComplete: () => void;
}) {
  const { state, stage, hint, aiToMove, place } = useTutorialGame(profile);
  const { currentPlayer, players, moves } = state;

  // Stable identities: Board and BoardCell are memoized on these.
  const colors = useMemo(
    () => ({
      [PlayerSymbol.X]: players[PlayerSymbol.X].color,
      [PlayerSymbol.O]: players[PlayerSymbol.O].color,
    }),
    [players],
  );
  const shapes = useMemo(
    () => ({
      [PlayerSymbol.X]: players[PlayerSymbol.X].shape,
      [PlayerSymbol.O]: players[PlayerSymbol.O].shape,
    }),
    [players],
  );

  const won = stage === "won";
  const placed = Math.ceil(state.moveCount / 2);
  const coach = coachFor(stage, placed, hint !== null);
  const playersTurn = currentPlayer === PlayerSymbol.X && !won;

  return (
    <StepShell
      color={profile.color}
      title="Practice round"
      progress={replay ? undefined : { current: 2, total: 3 }}
      onSkip={onSkip}
      focusTitle
      contentClassName="gap-3 max-sm:px-0"
      footer={
        won ? (
          <Button
            type="button"
            size="lg"
            variant="glass"
            onClick={onComplete}
            className="h-12 w-full text-base font-bold sm:h-14"
            style={ctaStyle(profile.color)}
          >
            {replay ? "Back to lobby" : "Continue"}
          </Button>
        ) : (
          <p className="py-3 text-center text-sm text-muted-foreground">
            Tap a square to place a mark.
          </p>
        )
      }
    >
      <div
        role="status"
        className="glass-cell mx-4 flex items-center gap-3 rounded-xl px-4 py-3.5 sm:mx-0"
      >
        <div className="min-w-0 flex-1">
          <p className="text-base font-bold text-foreground">{coach.title}</p>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{coach.body}</p>
        </div>
        <MarkMeter used={moves[PlayerSymbol.X].length} color={profile.color} />
      </div>

      {/* On a tall phone the board sits in the middle of what the guide
          leaves, as in the real game, not hung from the top. */}
      <div className="flex min-h-0 flex-1 flex-col justify-center">
        <Board
          board={state.board}
          colors={colors}
          shapes={shapes}
          winningCombination={state.winningCombination}
          nextToRemove={state.nextToRemove}
          previewPlayer={playersTurn ? PlayerSymbol.X : undefined}
          previewColor={playersTurn ? colors[PlayerSymbol.X] : undefined}
          previewShape={playersTurn ? shapes[PlayerSymbol.X] : undefined}
          disabled={aiToMove || won}
          disabledReason={
            won ? "the practice round is over" : aiToMove ? "the AI is replying" : undefined
          }
          hintIndex={hint}
          showVanish
          onCellClick={place}
        />
      </div>
    </StepShell>
  );
}
