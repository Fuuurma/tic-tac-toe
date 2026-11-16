# NPC personas for the vs-computer opponent (TTT-NPC-NAMES1)

2026-11-16 · slice TTT-NPC-NAMES1 · worktree `ttt-npc-names1` @ origin/main 7444e77

## What shipped

The vs-computer opponent is no longer the bare "AI" label. It gets a persona:
a short, family-friendly, pun-driven handle drawn from a 376-name roster,
pinned to one a match, never repeated within a browser session, and shown
everywhere the opponent is named — lobby card, in-game player card, turn
indicator ("Square Deal's turn" / "Square Deal thinking"), the game-over win
headline, and every aria label that carries a player name.

The approach is borrowed from gambit-deck's `src/lib/guestIdentity.ts`
(themed `as const` name pools, a flavored tier, one draw function, tests
pinning length/uniqueness/hygiene) — the approach, none of its chess names.

## The module

`src/game/npc-names.ts` — React-free game-domain module (no React imports,
matches the `src/game/` contract):

- `NPC_NAME_TIERS: Record<AI_Difficulty, readonly string[]>` — three tiers
  (EASY 111 / NORMAL 114 / HARD 151 = **376 names**), so a Hard bot sounds
  tougher ("Minimax", "Alpha Beta", "Abyss", "Absolute Zero") than an Easy
  one ("Waffles", "Bumbles", "Duck Duck Doug").
- `NPC_NAME_MAX_LENGTH = 14` — every name fits the opponent-name field's
  2-20 rule with the difficulty badge beside it.
- `BANNED_NAME_FRAGMENTS` — profanity / slur / drug / alcohol roots; the
  test holds every name against the list case-insensitively, so a future
  edit that drifts dirty cannot land quietly.
- `createNpcNameSession(rng?)` → `{ pick(difficulty) }` — picks from the
  tier's fresh names, widens to the whole roster when the tier runs dry,
  restarts (reserving the immediately-previous name) only when everything
  is exhausted; injected rng makes tests deterministic.
- `npcNameSession` — the app-wide draw pile; no repeat within a session.
- `isNpcName(name)` — the "this name drew itself" provenance check.
- `NPC_NAMES` — the flat roster, for e2e pins.

## Where a persona is drawn (one pick per match start)

- `lobbyForm.tsx` `initialOpponentName` — a fresh visitor meets a persona;
  a saved opponent name (the player's own choice) still wins. Online mode is
  excluded (its opponent is a human to be met).
- `lobbyForm.tsx` `handleGameModeChange` → Computer, and the render-phase
  online→computer fallback — each entry to Computer mode draws a fresh one.
- `useLocalGame.handleReset` — a rematch re-draws (the match is new) via
  `nextComputerOpponentName`; a name the player typed survives (it is not a
  roster name). Mount passes the lobby's pick through untouched, so the name
  the lobby card promised is the name the game shows.
- `App.tsx` — the settings sheet reads the running match's opponent name
  from game state, so a post-rematch sheet never describes a stale persona.
- `queuePlay.tsx` warm-up opponent — same rule as the lobby.

The tutorial/practice round keeps its scripted "AI" name: its coaching copy
("the AI answers") is written around that identity and its flow is a guided
script, not a match.

## Tests

- `src/game/npc-names.test.ts` (13) — roster size ≥ 300, every tier ≥ 100,
  2-14 chars, cross-tier uniqueness, banned-fragment hygiene, every name
  survives `sanitizeDisplayName` unchanged, tier membership of picks,
  determinism under a fixed rng, no-repeat across a full mixed-tier drain,
  exhaustion restart, `isNpcName` boundaries. Red-first: written against the
  missing module and the pre-change behaviour, watched failing (5 red cases
  across the three suites), then implemented.
- `src/hooks/useLocalGame.test.tsx` — persona reaches the first match
  verbatim, blank Computer-opponent names draw a persona at mount, rematches
  redraw, player-typed names survive resets.
- `src/components/lobby/lobbyForm.computerNames.test.tsx` — fresh visitors
  get a persona (not "AI"), re-entering Computer mode redraws, saved names win.
- `e2e/smoke.spec.ts` — the computer-opens test now recognises the computer
  card by persona + difficulty label instead of the literal "AI" prefix, and
  a new spec pins the persona end-to-end: lobby card → game card aria →
  "{persona} thinking" turn line.

## Gates

- `pnpm lint` — clean.
- `pnpm test` — 926 passed / 80 files (final clean run). Earlier runs showed
  4-5 failures in `ai.bench`, `game.property`, `matchmaking` and the
  `testEnv` meta-suite; all reproduced on a pristine `origin/main` checkout
  under the same load (CPU-bound benchmarks + a timing-sensitive
  matchmaking test) and passed in isolation on both trees — environment, not
  this change.
- `pnpm build` + `pnpm deploy:check` — clean; the roster adds ~5 KB raw to
  the main chunk (~1.6 KB gzipped measured on the built bundle), no budget
  or chunk-map test touched.
- `pnpm test:e2e` — 41 passed, 1 pre-existing flake (sheet drag-gesture,
  passed on retry), including the two persona specs.

## Evidence

- `reports/npc-personas-phone-lobby.png` — lobby card, persona before start
- `reports/npc-personas-phone-game.png` — in-game card "Wing It (Normal)"
- `reports/npc-personas-desktop-game.png` — turn indicator + cards, desktop
- `reports/npc-personas-desktop-lobby.png` — desktop lobby
(Reproduce with `node scripts/capture-personas.mjs` against a built `dist/`.)

## Decisions & open items

- Names are English-only proper nouns (puns do not translate); the guest-name
  generator stays localised, the persona rosters do not.
- A user who saves a persona name as their opponent name pins it for future
  sessions (existing save-on-sheet-change behaviour); within a session the
  no-repeat guarantee is untouched.
- The bundle has no numeric budget in `scripts/deploy-check.mjs` (it checks
  bundle policy: matchmaking URL, headers); the ~5 KB text addition is the
  honest cost and is reported here.
- Hard-tier names avoid direct copies of gambit-deck's `LEGENDARY_NAMES`.
