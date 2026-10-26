import { useState } from "react";
import { PLAYER_CONFIG, PlayerSymbol, oppositeColor } from "@/game/constants";
import {
  generateGuestDisplayName,
  getOrCreateGuestIdentity,
  saveDisplayName,
} from "@/lib/identity";
import { recordOnboardingOutcome } from "@/lib/onboarding";
import { loadPreferences, savePreferences } from "@/lib/preferences";
import { PracticeStep } from "./practiceStep";
import { ProfileStep, type Profile } from "./profileStep";
import { ReadyStep } from "./readyStep";
import { WelcomeStep } from "./welcomeStep";

type Step = "welcome" | "profile" | "practice" | "ready";

interface OnboardingFlowProps {
  /**
   * `first-run` is the full tour for a visitor we hold no data on. `replay`
   * reruns only the practice round for someone who already has a profile, and
   * leaves their saved setup and first-run record alone.
   */
  mode: "first-run" | "replay";
  onExit: () => void;
}

const freshProfile = (): Profile => ({
  displayName: generateGuestDisplayName(),
  color: PLAYER_CONFIG[PlayerSymbol.X].defaultColor,
  shape: PLAYER_CONFIG[PlayerSymbol.X].defaultShape,
});

const savedProfile = (): Profile => {
  const prefs = loadPreferences();
  const fallback = freshProfile();
  return {
    displayName: getOrCreateGuestIdentity().displayName,
    color: prefs.color ?? fallback.color,
    shape: prefs.playerShape ?? fallback.shape,
  };
};

/**
 * First-run onboarding: welcome, set up the player, a guided practice round on
 * the real board, then a short "you're ready". Every screen can be left, and
 * leaving is remembered so nobody is asked twice.
 *
 * The profile is written the moment it is confirmed, not at the end: someone
 * who skips the practice round still gets the name, color and symbol they
 * just chose.
 */
export function OnboardingFlow({ mode, onExit }: OnboardingFlowProps) {
  const replay = mode === "replay";
  const [step, setStep] = useState<Step>(replay ? "practice" : "welcome");
  const [profile, setProfile] = useState<Profile>(replay ? savedProfile : freshProfile);

  const leave = (outcome: "done" | "skipped") => {
    if (!replay) recordOnboardingOutcome(outcome);
    onExit();
  };

  const confirmProfile = (next: Profile) => {
    saveDisplayName(next.displayName);
    savePreferences({
      color: next.color,
      playerShape: next.shape,
      // The lobby derives the AI's color the same way; saving it keeps the two in step.
      opponentColor: oppositeColor(next.color),
    });
    setProfile(next);
    setStep("practice");
  };

  switch (step) {
    case "welcome":
      return <WelcomeStep onStart={() => setStep("profile")} onSkip={() => leave("skipped")} />;
    case "profile":
      return (
        <ProfileStep initial={profile} onConfirm={confirmProfile} onSkip={() => leave("skipped")} />
      );
    case "practice":
      return (
        <PracticeStep
          profile={profile}
          replay={replay}
          onSkip={() => leave("skipped")}
          onComplete={() => (replay ? leave("done") : setStep("ready"))}
        />
      );
    case "ready":
      return <ReadyStep profile={profile} onStart={() => leave("done")} />;
  }
}
