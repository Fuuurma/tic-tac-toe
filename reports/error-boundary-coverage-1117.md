# TTT-ERROR-BOUNDARY — cover the app's only crash fallback

Slice: `ttt-error-boundary` (run_d79f312c05ea / task_7c961ce6683f),
dispatch ctx_7b97ee16a407. Spec: `src/components/errorBoundary.tsx`.

## What was missing

`ErrorBoundary` renders the only crash fallback in the app and forwards
caught errors to `reportError`, but nothing rendered it: the existing
`src/lib/errorReporting.test.ts` exercises `componentDidCatch` as a bare
method call in the node environment, so a broken fallback — wrong copy,
missing `role="alert"`, a dead Retry — would turn a recoverable child
crash into a white screen with every suite still green.

## What landed

`src/components/errorBoundary.test.tsx` (jsdom, `@testing-library/react`,
same `vi.mock("@/lib/errorReporting")` seam as `errorReporting.test.ts`):

- children render untouched when nothing throws (control half);
- a throwing child renders `role="alert"` carrying the `err.title` /
  `err.body` copy and the Try again button;
- the caught error reaches `reportError` exactly once, with the error
  object and `{ componentStack: expect.any(String) }`;
- clicking Try again clears the boundary: the alert unmounts and the
  child renders again (the child is flag-controlled so the retry proves
  recovery, not just dismissal).

The `err.*` strings are asserted as English literals — the independent
source of truth is `src/i18n/en.ts`; jsdom's `en-US` navigator and empty
storage make the locale deterministic.

## Mutation proof (test-value)

Three simultaneous defects planted in `errorBoundary.tsx`, suite re-run,
then reverted:

- `role="alert"` removed → fallback and retry tests red;
- `reportError(...)` call removed → report test red;
- `handleReset` neutered to `void this` → retry test red;
- control test stayed green throughout.

Result: `3 failed | 1 passed` — exactly the behavioural half. The suite
cannot stay green while the fallback is broken.

## Gates

- `pnpm vitest run src/components/errorBoundary.test.tsx` — 4/4 green.
- `pnpm lint` — clean.
- `pnpm test` — 87 files / 995 tests green (991 baseline + 4 new).
- `pnpm build` (`tsc -b && vite build`) — clean.

## Notes

- Test-only slice; no production edits. `errorBoundary.tsx` was mutated
  for the red proof and restored byte-identical (`git checkout`).
- `window.location.reload()` on the Reload button is untested by design:
  jsdom cannot navigate, and the spec scoped coverage to the alert copy,
  reporting, and Retry.
