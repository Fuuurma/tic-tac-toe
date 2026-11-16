# TTT e2e smoke drag red on main — cause note (SLICE TTT e2e smoke drag test red)

Reproduces the red `e2e/smoke.spec.ts` phone sheet-drag spec named by
`reports/ux-fix-f2-f5-f6-f7-1116.md` ("sheet rests ~350px low instead of
springing back") on pristine `origin/main` @cf1dd85.

## Spec and symptom

`e2e/smoke.spec.ts:365` — "on a phone › a bottom sheet follows the finger
and dismisses on a long drag". Failure lands at `smoke.spec.ts:390` (was
:390 pre-edit): `expect.poll(top() - rest).toBe(0)` times out with the
sheet parked at `rest + ~360`, i.e. the `sheet-down` exit animation's held
final keyframe (`translate3d(0, 100%, 0)` ≈ the sheet's ~360px height).

Reproduced on the untouched tree: 4/12, 3/30, then 22/40 instrumented
rounds red — load-sensitive, matching the earlier report.

## Cause

The test, not the product. The spec's "short drag" sends five 12px
`Input.dispatchTouchEvent` touchMoves back-to-back; CDP acks each dispatch
as fast as it can, so the events land 15–50ms apart. The sheet's fling
detector (`src/hooks/useDragToDismiss.ts`) judges dismissal on the *last*
pointermove interval: `velocity = dy/dt`, threshold `DISMISS_VELOCITY =
0.5px/ms` (500px/s) — "a flick this fast dismisses regardless of how far
it travelled" (DESIGN.md:88).

Instrumented `end()` on failing rounds, verbatim:

```
move y=617 dt=16   v=0.75
move y=629 dt=30.6 v=0.39
move y=641 dt=33   v=0.36
move y=653 dt=20.8 v=0.58
move y=665 dt=15.7 v=0.76
end  y=665 dy=60   v=0.76 fling=true dragged=false cancelled=false
```

Sixty px of travel is under `DISMISS_DISTANCE` (96), so the only dismiss
path is `fling`. Whether the last interval reads 0.35 or 0.80 px/ms is
pure CDP delivery jitter — the test specifies positions but no timing, so
roughly half its runs are literally flicks and the product correctly
dismisses. Pointer capture, `touch-action` and the hit target all behaved:
the drag engaged, tracked the finger (`offset` followed `dy`), and the
decision matched the contract for the events it was given.

A product-side estimator change cannot make this spec deterministic: the
gesture's *average* velocity is ~60px/130ms ≈ 0.46px/ms — already within
10% of the 0.5 threshold — so even a windowed velocity stays on the
boundary under load. The gesture itself had to become unambiguous.

## Fix

`e2e/smoke.spec.ts` — pace the five touchMoves of the short drag with
`waitForTimeout(80)` between dispatches (~3.5× margin under the flick
threshold: last interval ≥~75ms ⇒ v≈0.16px/ms). The wait is part of the
input gesture — it is what makes the drag a drag — while every assertion
stays state-driven (`expect.poll` on geometry). The long drag is left
unpaced on purpose: 168px > 96px clears the distance threshold, so timing
cannot change its outcome.

No skip, retry bump or timeout change; no product code touched.

## Verification

- Red first: un-paced spec failed 4/12 then 22/40 instrumented rounds on
  this tree @cf1dd85 (pristine main — the worktree had no product diff).
- Green after: 15/15 consecutive `playwright test e2e/smoke.spec.ts -g
  "bottom sheet"` runs against the preview bundle.
- Gates: `pnpm lint`, `pnpm test`, `pnpm build`, `pnpm deploy:check` —
  see commit body / task done evidence.

## Open / notes

- `useDragToDismiss` still decides fling on a single inter-event
  interval. On real devices touchmove cadence is steady (vsync/digitizer
  aligned), so the last sample is representative; the phantom-flick case
  needs event-time compression that mostly shows up under synthetic CDP
  bursts. If field data ever shows premature dismissals, a windowed
  velocity (Android `VelocityTracker`-style) is the follow-up — deliberately
  not bundled here: it would dilute genuine last-instant flicks and is a
  UX trade-off, not this bug's cause.
- Sibling lane `ttt-queue-play-red1` owns `e2e/queue-play.spec.ts`; not
  touched.
