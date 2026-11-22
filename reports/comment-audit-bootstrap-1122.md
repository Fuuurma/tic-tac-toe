# Comment audit bootstrap — 2026-11-22

Task t_01M7WXFYCK77X6A4PFX5F92CE5. First slice of the repo-wide comment audit:
full inventory, classification, safe removals, ADR moves, and completion of the
no-new-comments ratchet over source, tests and scripts.

## Corpus and method

Inventory via `scripts/check-comments.mjs` exports (`collectComments`,
`inventoryAt`) — the same language-aware parser the ratchet uses, so no
discovery drift. Measured over `src/`, `e2e/` and `scripts/` (181 files):

| Measure | Before | After this slice |
|---|---|---|
| Comment blocks | 3,144 | 3,124 |
| Comment-only physical lines | 4,664 | 4,626 |
| Inline (code-adjacent) comment lines | 129 | 129 |
| Ratchet scope | `src`, `scripts` (2,933 blocks) | `src`, `scripts`, `e2e` (3,124 blocks) |
| Baseline files | 161 | 170 |

Kind mix before the slice: 2,644 line comments, 400 JSDoc blocks, 100 plain
block comments.

## Classification

- **Decision records / rationale (majority, kept).** The repo's `//` prose is
  overwhelmingly load-bearing: fleet-findings references (F712/F726, F312),
  hostile-peer contract rationale, replay-ordering notes. A repo-wide sweep for
  stale identifiers (comment-mentioned names that exist nowhere in the tree)
  found **0 stale comments**.
- **Required directives (kept).** 37 test files carry the jsdom environment
  pin; 2 files carry triple-slash reference tags. These are tooling contracts.
- **API documentation (kept).** JSDoc on exported surfaces that carries return
  semantics, wire contracts, or prop meaning — e.g. the room-protocol docs.
- **Tautologies (removed, 20 blocks / 38 lines).**
  - `src/hooks/usePeerRoom.ts` — five name-restating JSDoc blocks
    (`clearTimerRef`, `clearWaitingForHost`, `resetRoomScopedRefs`,
    `TurnTimerGate`, `shouldRunTurnTimer`).
  - `src/components/lobby/playerSettingsSheet.tsx` — five 3-line
    dash-divider banners whose labels restate the declaration below them
    (`NameField`, `PlayerTab`, `OpponentTab`, `PlayerSummaryCard`, file header).
- **Excuses (none found).** No comment rationalizes a workaround or swallowed
  error; the deliberate-swallow sites (`storage.ts` pattern, catch markers)
  are documented decision records with evidence. No repair tasks filed from
  this class.
- **Decisions moved to ADRs (2).**
  - `docs/adr/0001-shared-localstorage-guard.md` — from the
    `src/lib/storage.ts` header (four byte-identical guards consolidated);
    source comment trimmed to the load-bearing environment contract + pointer.
  - `docs/adr/0002-outside-press-dismissal-rides-click.md` — from the
    `src/hooks/useDismissOnOutsidePress.ts` header (click-vs-pointerdown
    reflow story); source comment keeps the contract lines + pointer.

## Savings

- **Current (this slice):** 20 blocks and 38 comment-only physical lines
  removed; measured by the same parser before/after (table above).
- **Projected (follow-up areas, evidence-based):**
  - Room-protocol + `usePeerRoom.ts` JSDoc normalization: 55 wrapped
    one-sentence JSDoc blocks (3–5 physical lines each) could collapse to one
    line where the text is a pure restatement — an upper bound of ~180 lines,
    to be adjudicated per block in the follow-up task.
  - Rematch family (`sendRematchRequest`, `applyRematchAccept/Decline/Cancel`,
    `expireRematchRequest`, `canRequestRematch`, `canAcceptRematch`): 7
    name-restating one-idea blocks, ~21 lines, keep-or-drop as a family for
    uniformity.
  - JSX region labels (e.g. `/* Players panel skeleton */`): ~14 blocks across
    `App.tsx`, `onlineGameSurface.tsx`, `playersPanel.tsx`, `lobbyForm.tsx`,
    `onboarding/*` — navigational, owner's call.

## Follow-up tasks

All are independent (no blocking edges); each has the same verify command:
`pnpm lint && pnpm test && pnpm build`.

1. **COMMENT-SCAN-REGEX1** (repair task for the one scanner defect found):
   `collectComments` mis-reads a regex literal containing two adjacent slashes
   as a line comment, so the baseline freezes phantom lexemes — observed in
   `src/__tests__/pwaManifest.test.ts:39,92` and `e2e/queue-play.spec.ts:86,231`
   (4 blocks). Editing such a regex fails lint with a confusing "changed
   comment" message. Fix in `scripts/check-comments.mjs`: give the scanner
   regex context the same way the template-literal fix does (parse-driven
   comment collection), with a regression test on a regex containing adjacent
   slashes, then re-freeze. This is the same defect class as the
   template-interpolation fix already in the file.
2. **COMMENT-ROOM-PROTOCOL-DOC1**: adjudicate the 55 wrapped one-sentence JSDoc
   blocks in `src/lib/room-protocol/*` and `src/hooks/usePeerRoom.ts`; collapse
   restatements, keep decision records and wire contracts. Area-specific so
   the diff stays reviewable.
3. **COMMENT-REMATCH-FAMILY1**: rematch-family JSDoc keep-or-drop decision
   (7 blocks, list above); apply uniformly.
4. **COMMENT-JSX-LABELS1**: adjudicate the ~14 JSX region labels; keep only
   where the section boundary is not visible from the code.

The ratchet already covers all four follow-ups: deletions are free, additions
and reworded lexemes fail `pnpm lint` until the baseline is re-frozen with
`node scripts/check-comments.mjs --update-baseline`.
