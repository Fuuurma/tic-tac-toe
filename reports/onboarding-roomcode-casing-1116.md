# TTT onboarding room-code e2e red after FIX2 uppercase canonicalRoomId

Slice: `ttt-onboarding-roomcode1` (run_04e64dc1ff4c / task_190579787c8f).

## The red spec

`e2e/onboarding.spec.ts:102` — test "an invited friend goes straight to
their room" (line 100). Reproduced on `origin/main` `f75af60` with the
matchmaking Worker up on `127.0.0.1:8787`:

```
Locator:  getByLabel(/^Room code/)
Expected: "friday-game"
Received: "FRIDAY-GAME"
```

6/7 onboarding specs green; this one red — the same baseline-red
TTT-UX-FIX4 recorded in `reports/ux-fix4-1116.md` ("e2e 42/43, one
baseline-red").

## Root cause — the spec is stale, not the product

TTT-UX-FIX2 (`12d87d2`) made `canonicalRoomId()` (`src/lib/roomId.ts`)
the one wire spelling for room codes: whitespace out, **uppercase**. The
invite link `?room=friday-game` is normalized in `App.tsx` (`normalizeRoomId`
on the `room` param) and lands in the join field as `FRIDAY-GAME` — the
canonical code the relay keys on. FIX2 updated the unit pin
(`src/App.onboarding.test.tsx:62` expects `"FRIDAY-GAME"`) but missed this
e2e spec, which still asserted the pre-FIX2 lowercase echo.

Product contract check (`src/lib/roomId.ts` doc + `roomId.test.ts`,
`reports/ux-audit-1116/`): codes are **case-insensitive on input, shown
uppercase**. Verified the product honours it:

- Typed/pasted lowercase still works — `joinAsGuest` and `startAsHost`
  (`src/lib/room-protocol/roomLifecycle.ts:271,342`) run every code through
  `canonicalRoomId`, so `friday-game` and `FRIDAY-GAME` dial the same room.
- The join field itself stores raw text; canonicalization happens at the
  wire boundary, not on each keystroke — so `smoke.spec.ts`'s carry-over
  assertion (`"friday-game"` typed into Create, seen in Join) is unaffected.
- i18n copy already tells users "letter case doesn't matter" / "letters
  save in capitals" (EN+ES, FIX2).

No product change needed: nothing breaks a typed lowercase code.

## Fix

`e2e/onboarding.spec.ts:104` — expect the canonical `"FRIDAY-GAME"` the
contract specifies, with a comment naming `canonicalRoomId` so the next
reader does not re-litigate the casing. The test still exercises the real
behaviour: a lowercase invite URL lands straight in the lobby with the
code prefilled and onboarding skipped.

Note for reruns: `pnpm test:e2e` needs the matchmaking Worker on
`127.0.0.1:8787` (`pnpm dev` in `~/Projects/fuurma-matchmaking`). Without
it the lobby's `serverDown` fallback flips Online→Computer and this spec
fails earlier with "element(s) not found" — a different red, same line.

## Gates

All run on this lane's tree (slot-leased; H3 for the browser pass, H2 for
the rest):

- Repro on `f75af60`: `playwright test e2e/onboarding.spec.ts` → 1 failed
  (the casing mismatch above), 6 passed.
- Post-fix: `playwright test e2e/onboarding.spec.ts --repeat-each=2` →
  14/14 green (each spec twice, against `vite preview` of the
  `VITE_MATCHMAKING_URL` build).
- `pnpm lint` — clean.
- `pnpm test` — 991 tests / 86 files green.
- `pnpm build` — green (`tsc -b && vite build`).
- `pnpm deploy:check` — green ("dist/ looks ready").
