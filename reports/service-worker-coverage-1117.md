# TTT-SERVICE-WORKER-COVERAGE-1117 — serviceWorker.ts registration and throw safety

Branch `fleet/ttt-service-worker`, commit `7b1c864` (base `origin/main@e2ac570`).
`src/lib/serviceWorker.ts` was the only `src` module no test reached.

## What the suite pins (`src/lib/serviceWorker.test.ts`, 5 cases)

1. a dev build (`PROD` false) registers nothing, even after `load`;
2. with the document still loading, `/sw.js` registers once, only after
   `load` — a second `load` does not register again (`{ once: true }`);
3. when `document.readyState` is already `complete`, `/sw.js` registers
   immediately;
4. a rejected `register()` is reported through `reportError` with
   `{ source: "serviceWorker.register" }` and does not throw;
5. a `register()` that throws synchronously neither escapes
   `registerServiceWorker()` nor goes unreported.

## Red-first

Case 5 was the real defect, and it failed first on the unfixed module:

```
FAIL  src/lib/serviceWorker.test.ts > registerServiceWorker > survives a register() that throws synchronously
AssertionError: expected [Function] to not throw an error but 'Error: register blew up' was thrown
❯ src/lib/serviceWorker.test.ts:103:47
```

`main.tsx` calls `registerServiceWorker()` before the first render, so that
throw killed the boot path. Cases 1–4 passed before the fix, so they document
the existing contract rather than the change.

## Fix

`register` now wraps the same `navigator.serviceWorker.register("/sw.js")`
call in `try/catch` and shares one reporter with the promise `.catch`. The
registration timing and error payload are unchanged.

## Mutation proof (test-value)

With the guard reverted, the suite must go red; each mutation reds a named
case and was reverted after the run:

| mutation | red case(s) |
| --- | --- |
| drop the `PROD` guard | registers nothing in a dev build |
| ignore `readyState`, always wait for `load` | registers immediately when the document has already loaded; refused registration; sync throw |
| `"/sw.js"` → `"/service-worker.js"` | registers /sw.js once after load; registers immediately |
| silence the reporter | refused registration; sync throw |

## Gates

`pnpm exec tsc --noEmit` 0 · `pnpm lint` 0 · `pnpm test` 996/996 (87 files).
