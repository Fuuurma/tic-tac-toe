import { useEffect, useMemo, useState } from "react";
import { Bot, Loader2, UserCheck } from "lucide-react";
import {
  AI_Difficulty,
  GameModes,
  PLAYER_CONFIG,
  PlayerSymbol,
  PlayerTypes,
  oppositeColor,
  type AI_Difficulty as AI_DifficultyType,
  type Color,
  type SymbolShape,
} from "@/game/constants";
import { getDifficultyLabel, t } from "@/i18n/language";
import { useGameStats } from "@/hooks/useGameStats";
import { useLocalGame } from "@/hooks/useLocalGame";
import { useRecordLocalResult } from "@/hooks/useRecordLocalResult";
import { loadPreferences } from "@/lib/preferences";
import { handleRadioGroupKeyDown } from "@/lib/radioGroup";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ctaStyle } from "@/components/onboarding/ctaStyle";
import { HelpDrawer } from "./helpDrawer";
import { LocalBoard } from "./localBoard";
import { PlayersPanel } from "./playersPanel";

/**
 * Play the computer while a Quick Match search is still running.
 *
 * The queue is the hook's business (usePeerRoom keeps polling the ticket the
 * whole time); everything here is a local game laid on top of it. Three
 * pieces: the invite on the search card, the one-line strip that keeps the
 * search visible during play, and the warm-up game itself with its
 * match-found handoff.
 */

const DIFFICULTIES: AI_DifficultyType[] = Object.values(AI_Difficulty);

/** What the player is offered while the search card is up. */
export function WarmupInvite({
  difficulty,
  color,
  onDifficultyChange,
  onStart,
}: {
  difficulty: AI_DifficultyType;
  color: Color;
  onDifficultyChange: (difficulty: AI_DifficultyType) => void;
  onStart: () => void;
}) {
  return (
    <div className="flex w-full flex-col gap-2 max-sm:gap-3">
      <div
        role="radiogroup"
        aria-label={t("queue.difficulty")}
        className="grid grid-cols-3 gap-2"
        onKeyDown={handleRadioGroupKeyDown}
      >
        {DIFFICULTIES.map((value) => {
          const label = getDifficultyLabel(value);
          const active = difficulty === value;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-label={label}
              aria-checked={active}
              data-state={active ? "active" : "inactive"}
              tabIndex={active ? 0 : -1}
              onClick={() => onDifficultyChange(value)}
              className={cn(
                "flex min-h-11 items-center justify-center rounded-lg border px-2 py-2 text-xs font-semibold transition max-sm:h-12 max-sm:text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1",
                active
                  ? "border-[rgb(var(--player-color))] bg-[rgb(var(--player-color)/0.1)] text-foreground shadow-sm ring-1 ring-[rgb(var(--player-color)/0.2)]"
                  : "border-border/70 bg-background/50 text-muted-foreground hover:border-[rgb(var(--player-color)/0.4)] hover:bg-muted/60 hover:text-foreground",
              )}
            >
              {label}
            </button>
          );
        })}
      </div>
      <Button
        variant="glass"
        onClick={onStart}
        style={ctaStyle(color)}
        // Height is a floor, not a fixed size: a longer translation wraps to
        // two lines instead of clipping at the button's edge.
        className="h-auto min-h-11 w-full py-2 max-sm:min-h-12 max-sm:text-base max-sm:font-semibold"
      >
        <Bot className="size-4" aria-hidden="true" />
        {t("queue.playWhileWaiting")}
      </Button>
    </div>
  );
}

export type StripPhase = "searching" | "matched" | "ended";

/**
 * The search, reduced to one line, for as long as a game is on screen.
 *
 * It outranks nothing: the board stays the hero. It only keeps the three
 * things a waiting player needs in reach: the search is alive, how crowded
 * the queue is, and a way out. When the search ends without a game, it turns
 * into the reason plus the next step instead of vanishing under the board.
 */
export function QueueStrip({
  phase,
  detail,
  message,
  onLeave,
  onSearchAgain,
}: {
  phase: StripPhase;
  detail?: string;
  message?: string;
  onLeave: () => void;
  onSearchAgain: () => void;
}) {
  if (phase === "ended") {
    return (
      <div
        role="alert"
        className="glass flex w-full flex-col items-center gap-2 border-destructive/30 bg-destructive/15 px-3 py-2 max-sm:px-4 max-sm:py-3"
      >
        <span className="text-xs text-destructive max-sm:text-sm">{message}</span>
        <div className="flex w-full flex-col gap-1.5 sm:w-auto sm:flex-row">
          <Button size="sm" variant="glass" onClick={onSearchAgain} className="w-full sm:w-auto max-sm:h-12">
            {t("queue.searchAgain")}
          </Button>
          <Button size="sm" variant="glass" onClick={onLeave} className="w-full sm:w-auto max-sm:h-12">
            {t("online.backSetup")}
          </Button>
        </div>
      </div>
    );
  }

  const matched = phase === "matched";
  return (
    <div className="glass flex w-full items-center gap-3 px-3 py-2 max-sm:px-4 max-sm:py-3">
      <Loader2
        className="size-4 shrink-0 animate-spin text-[rgb(var(--player-color))]"
        aria-hidden="true"
      />
      <div role="status" aria-live="polite" className="min-w-0 flex-1">
        <p className="text-sm font-medium leading-tight text-foreground">
          {matched ? t("queue.matchedBody") : t("queue.searching")}
        </p>
        {detail && !matched && (
          <p className="text-[11px] leading-tight text-muted-foreground max-sm:text-xs">{detail}</p>
        )}
      </div>
      <Button size="sm" variant="glass" onClick={onLeave} className="shrink-0 max-sm:h-12">
        {matched ? t("queue.cancel") : t("queue.leave")}
      </Button>
    </div>
  );
}

/**
 * The computer's side of a warm-up. It follows the lobby's rules for a vs
 * Computer opponent (saved preference, never the player's own colour), so a
 * warm-up looks like the game the player already knows.
 */
function warmupOpponent(playerColor: Color) {
  const prefs = loadPreferences();
  return {
    name: prefs.opponentName ?? t("lobby.defaultAI"),
    color:
      prefs.opponentColor && prefs.opponentColor !== playerColor
        ? prefs.opponentColor
        : oppositeColor(playerColor),
    shape: prefs.opponentShape ?? PLAYER_CONFIG[PlayerSymbol.O].defaultShape,
  };
}

/**
 * A vs Computer game that lives exactly as long as the search lets it.
 *
 * `handoff` is the moment a human opponent is found: the game freezes
 * under an overlay that blocks the board, so a tap meant for the warm-up
 * cannot land on the real match that replaces it. The overlay stays until
 * the surface swaps this out for the online board, which only happens once
 * the connection is up, so the real game's turn clock never starts while the
 * player is still looking at the old one.
 *
 * Renders a fragment: the HUD and board join the surface's column so the
 * phone layout orders them exactly like an online game.
 */
export function QueueWarmup({
  player,
  difficulty,
  handoff,
  onStop,
}: {
  player: { displayName: string; color: Color; playerShape: SymbolShape };
  difficulty: AI_DifficultyType;
  handoff: boolean;
  onStop: () => void;
}) {
  const [opponent] = useState(() => warmupOpponent(player.color));
  const input = useMemo(
    () => ({
      gameMode: GameModes.VS_COMPUTER,
      playerName: player.displayName,
      opponentName: opponent.name,
      playerColor: player.color,
      opponentColor: opponent.color,
      playerShape: player.playerShape,
      opponentShape: opponent.shape,
      aiDifficulty: difficulty,
      opponentType: PlayerTypes.COMPUTER,
    }),
    [player.displayName, player.color, player.playerShape, opponent, difficulty],
  );
  const { gameState, humanSymbol, handleCellClick, handleReset, exit, setPaused, paused } =
    useLocalGame(input);
  const gameStats = useGameStats();
  useRecordLocalResult(gameState, humanSymbol, gameStats);

  const [helpOpen, setHelpOpen] = useState(false);
  const [panelPaused, setPanelPaused] = useState(false);
  useEffect(() => {
    setPaused(handoff || helpOpen || panelPaused);
  }, [handoff, helpOpen, panelPaused, setPaused]);

  return (
    <>
      <PlayersPanel
        gameState={gameState}
        stats={gameStats.stats}
        gameMode={GameModes.VS_COMPUTER}
        aiDifficulty={gameState.aiDifficulty}
        message={gameState.turnNotice ?? ""}
        onNewGame={handleReset}
        onHelp={() => setHelpOpen(true)}
        onPauseChange={setPanelPaused}
        paused={paused}
        // Leaving the warm-up is not leaving the queue: the search card
        // comes back and the place in line is untouched.
        onExit={() => {
          exit();
          onStop();
        }}
      />
      <div className="relative flex min-h-0 flex-1 flex-col justify-center max-sm:order-5">
        <LocalBoard gameState={gameState} paused={paused} onCellClick={handleCellClick} />
        {handoff && (
          <div className="absolute inset-0 z-20 grid place-items-center rounded-2xl bg-black/50">
            <div
              role="status"
              aria-live="polite"
              className="glass animate-pop-in mx-4 flex flex-col items-center gap-1.5 px-6 py-5 text-center"
            >
              <UserCheck className="size-6 text-[rgb(var(--player-color))]" aria-hidden="true" />
              <p className="text-base font-semibold text-foreground">{t("queue.matchedTitle")}</p>
              <p className="text-sm text-muted-foreground">{t("queue.matchedPaused")}</p>
            </div>
          </div>
        )}
      </div>
      <HelpDrawer inline isOpen={helpOpen} onClose={() => setHelpOpen(false)} />
    </>
  );
}
