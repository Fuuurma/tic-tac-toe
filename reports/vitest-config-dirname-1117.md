# TTT-VITEST-CONFIG-DIRNAME — vitest.config.ts uses import.meta.dirname

Slice: `ttt-vitest-dirname` (run_d79f312c05ea / task_fa13658b8514),
dispatch ctx_64c6f93c723c. Sibling of `vite.config.ts` in e2ac570.

## What was wrong

`vitest.config.ts` resolved the `@` alias with `path.resolve(__dirname,
"src")`. `__dirname` does not exist in an ES module, so every Vitest run
printed:

```
(!) Your Vite config uses features that are unsupported by `configLoader: 'native'`, which is planned to become the default in a future major version of Vite:
  - `__dirname` (vitest.config.ts:18:25). Use `import.meta.dirname` instead
```

It is the same warning `vite.config.ts` carried before e2ac570: the
bundler loader papers over `__dirname` today, and the native loader —
the planned default — does not.

## The change

One line in `vitest.config.ts`:

```diff
-      "@": path.resolve(__dirname, "src"),
+      "@": path.resolve(import.meta.dirname, "src"),
```

`import.meta.dirname` is the directory of the module itself, so it is the
same value `__dirname` held. Under the bundler loader Vite rewrites it to
the injected original dirname; under the native loader it is the file's
real directory. Both resolve the alias to `<repo>/src`.

## Evidence

- **Before:** `npx vitest run src/__tests__/testEnv.test.ts` printed the
  `configLoader: 'native'` warning naming `__dirname (vitest.config.ts:18:25)`.
- **After:** `pnpm test` printed zero occurrences of `configLoader`
  (grep over the full output).
- **Paths identical, native loader:** importing `vitest.config.ts`
  directly under Node's native type stripping prints
  `resolve.alias["@"] = /Users/sergi/Projects/worktrees/ttt-vitest-dirname/src`,
  the same path `path.resolve(__dirname, "src")` produced.
- **Paths identical, bundler loader:** the 1015-test suite resolves `@/…`
  imports in every suite under the bundler loader `pnpm test` uses.

## Gates

- `pnpm test` — 92 files / 1015 tests green, no configLoader warning.
- `pnpm lint` — clean.
- `pnpm build` (`tsc -b && vite build`) — clean, no configLoader warning.

The spec named 1011/1011; `origin/main` moved to `0c1b7cf` before this
slice started, and the error-boundary suite it carries adds 4 tests, so
the same tree now runs 1015.

## Notes

- Config-only change; one file, one line. No test added: the acceptance is
  the absence of the warning, and the suite count stays as the spec
  expects.
- `docs/ttt-vanish-duration-pin-2026-11-17.md` carried a note that
  `vitest.config.ts` still used `__dirname`; that note is amended so the
  repo stops pointing at a fixed warning.
