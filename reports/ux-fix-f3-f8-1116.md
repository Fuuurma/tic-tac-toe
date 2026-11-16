# UX fixes F3 + F8 — verification (TTT-UX-FIX1)

Fixes the launch-readiness UX audit's F3 and F8 touch-target findings
(reports/ux-audit-1116.md @680792b).

## Change

- **F3** — `src/components/lobby/languageSwitcher.tsx:43`: the `size="sm"`
  variant now carries `max-sm:min-h-11` (44px on phones), matching the md
  variant's existing treatment. `size="sm"` is used only by the onboarding
  welcome step (`welcomeStep.tsx:55`).
- **F8** — `src/components/game/socialReactions.tsx`: `max-sm:min-h-11` on
  the mute button, the "Reactions" `<summary>` trigger, and the ten
  quick-chat buttons in the dropdown. The summary additionally became
  `inline-flex items-center` so the min-height applies to the inline
  element.

## Gates

`pnpm lint`, `pnpm test` (80 files / 921 tests), `pnpm build`,
`pnpm deploy:check` — all green. e2e: `onboarding.spec.ts` 7/7,
`quick-match.spec.ts` 1/1, `smoke.spec.ts` 23/23,
`queue-play.spec.ts` fails identical on pristine `origin/main` (baseline
timing family owned by TTT-AI-TIMING-RED1; verified by stash + rerun).

## Re-run of the audit's checks

After-shots in `reports/ux-audit-1116/after/` (390×844 + 1440×900, light):

| Finding | Before (audit) | After (this slice) |
|---|---|---|
| F3 language buttons | `onboarding-welcome-phone-light.png` — 59×28, 62×28 | `after/onboarding-welcome-phone.png` — 59×44, 62×44; desktop `after/onboarding-welcome-desktop.png` unchanged at 28px |
| F8 reaction controls | `online-game-host-phone-light.png` — reactions items 174×36, "Mute reactions" 112×38 | `after/online-game-host-phone.png` + `after/online-game-host-reactions-phone.png` — mute 112×44, summary 83×44, all 10 quick-chat items 174×44; desktop `after/online-game-host-desktop.png` unchanged at 38px |

Measurements: `after/measurements-f3-f8.json`, captured by
`audit/capture-after-f3-f8.mjs` (CDP bounding boxes on the preview bundle).

Axe re-run (wcag2a/2aa/best-practice): welcome step clean. Online host
shows the audit's own F5 (`page-has-heading-one`) and F6
(`scrollable-region-focusable`) — owned by other slices, unchanged by
this one. No horizontal scroll at 390px in any captured state.

## Open / notes

- F7 (`text-[11px]` HUD label) was in the same audit sweep row but is not
  in this slice's scope.
- The audit's F2 hidden sheet-X is unrelated but was worked around during
  verification (player settings configured at desktop width, mirroring
  `e2e/quick-match.spec.ts`).
