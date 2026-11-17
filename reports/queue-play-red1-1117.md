# TTT-QUEUE-PLAY-RED1 — e2e queue-play timing red

Slice: `ttt-queue-play-red1` (run_d79f312c05ea / task_13c1537766c5),
dispatch ctx_00ea163ac75c. Spec: `e2e/queue-play.spec.ts`.

## What was reported

WORK.md row (auto-intake 2026-11-16 17:46): "e2e/queue-play.spec.ts (3
tests) fails identically on pristine tic-tac-toe origin/main 47306ce
(seen by TTT-UX-FIX1, reports/ux-fix-f3-f8-1116.md), timing family.
Find the cause (product race vs test wait); no skip/retry-bump."

## Reproduction attempts — the red did not reproduce

- `npx playwright test e2e/queue-play.spec.ts` at `a57dc87` (dispatch
  base): 9/9 green.
- Same spec at pristine `47306ce` in a scratch clone (`.tmp/ttt-47306ce`,
  since removed): 9/9 green.
- `--repeat-each=4` at HEAD: 36/36 green.
- Full `playwright test` suite at HEAD: all 9 queue-play tests green;
  unrelated reds were `onboarding.spec.ts` (needs the Worker on :8787 —
  documented prerequisite, reports/onboarding-roomcode-casing-1116.md)
  and two `smoke.spec.ts` tests dying on "browser has been closed" —
  a renderer crash under fleet host load (load avg ~17 on 10 cores;
  TTT-AI-TIMING-RED1 documents 15–40).

~140 spec executions across both commits, zero queue-play failures. The
original observation window coincided with the heaviest fleet load on
record; the same suite run produced browser-process crashes in sibling
specs, which is the signature of host contention, not a product defect.

## Audit — the one unguarded async read in the spec

Every wait in the spec auto-retries (`expect`, `expect.poll`, locator
actions) except one: the quick-match handoff test read `queue.relay()`
once, synchronously:

```ts
const relay = queue.relay();
expect(relay).not.toBeNull();
```

`relay` is assigned inside Playwright's `routeWebSocket` callback — a
Node-side delivery independent of the DOM updates the preceding
assertions waited on. The "Opponent found" render can be observed before
the interception callback has run; under CPU starvation that lag is
unbounded, and the sync `expect` fails instantly with `Received: null`.
`openRoom` in the same file already handles this correctly with
`expect.poll(() => relay).not.toBeNull()` — the quick-match path was the
drifted copy.

Product side audited and cleared: on `matched` the poll loop calls
`setStatus({queue:"matched"})` then `startAsHost` synchronously
(`src/lib/room-protocol/matchmaking.ts:181-189` →
`roomLifecycle.ts:startHostAttempt` → `room.connect()` → `new
WebSocket` inside the SDK's `openSocket` promise executor). The socket
is dialed in the same task as the state write; there is no product race
— the test simply did not wait for Playwright's own async interception.

## Red-first proof

Injected a 250 ms delay into the `routeWebSocket` assignment (simulating
host-load lag on the Node side):

- Before fix: `expect(received).not.toBeNull() Received: null` at the
  old line — the exact timing-family failure shape.
- After fix (`await expect.poll(() => queue.relay()).not.toBeNull()`):
  green under the same 250 ms delay. Delay removed; the poll stays.

## Fix

`e2e/queue-play.spec.ts` — the handoff test now polls for the scripted
relay before driving it, matching `openRoom`'s convention. No test
skipped, no timeout or retry touched. Commit `ccefba7` on `main`.

## Gates

- `pnpm test:e2e queue-play.spec.ts` — 9/9 green, two consecutive runs
  (the spec has 9 tests; the reported "3 red" was the observed subset).
- `pnpm lint` — clean.
- `pnpm test` — 991 tests / 86 files green.
- `pnpm build` — green.

## Honest residual

The three originally-red tests cannot be named — the observing lane's
traces are gone and the failure does not reproduce on this host anymore.
If the reds return, the likeliest remaining family is the 30 s/60 s test
ceilings under extreme load (the spec's slowest tests run ~4 s), which
this slice deliberately did not touch per the no-timeout-bump constraint.
The fixed race was the only mechanism in the spec that converts ordinary
timing jitter into an immediate hard failure.

Environment note: `npx playwright install chromium` was needed once —
the cache carried headless-shell 1194/1254 while @playwright/test 1.61.1
wants 1228. `CHROME_EXECUTABLE` unset; browsers now at
`~/Library/Caches/ms-playwright/chromium_headless_shell-1228`.
`pnpm e2e` is not a script — the e2e gate is `pnpm test:e2e`.
