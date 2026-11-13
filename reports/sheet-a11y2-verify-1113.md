# Sheet a11y — react-doctor verification (TTT-RD-SHEET-A11Y2)

**Verdict:** ALREADY_FIXED — no code change. Verified at `2834e80`, which is
`origin/main`.

## Finding

`stream/mechanical/2026-11-13-react-doctor-tic-tac-toe.md` in software-factory
(generated at HEAD `09c9d0b`, before `2834e80`) reported four a11y diagnostics
on `src/components/ui/sheet.tsx`:

- `click-events-have-key-events` and `no-static-element-interactions` at
  `:332` — the inline-path scrim `<div>`'s `onClick` backdrop dismissal
- `click-events-have-key-events` and `no-noninteractive-element-interactions`
  at `:358` — the modal-path `<dialog>`'s `onClick` backdrop dismissal

## Why it is already fixed

`2834e80` (TTT-RD-SHEET-A11Y1, "sheet backdrop clicks move to native
listeners") removed both JSX `onClick` props and attaches the backdrop
listener to the element itself inside an effect (`sheet.tsx` ~L210-219),
keeping backdrop-vs-panel click semantics on both paths; `sheet.test.tsx`
pins that behaviour. The report's line numbers match the pre-`2834e80` file
exactly: `:332` was the scrim `<div>`, `:358` the modal `<dialog>`.

## Verification

`npx react-doctor@0.9.14 --json` re-run in this worktree at `2834e80`:

- `sheet.tsx`: **zero a11y diagnostics**. Only the two P3 complexity rows
  the stream report also carries remain (`no-high-complexity-react-function`
  and `no-giant-component` at `:70`) — separate findings this slice does not
  own.
- Repo-wide: 9 diagnostics, identical to the stream report minus the four
  cleared a11y rows.

Backdrop click, Esc (`onCancel` on the modal path, the keydown effect on the
inline path) and exit-animation behaviour are untouched — the tree carries
no code diff against `2834e80`.

## Gates

Run on this tree (code identical to `2834e80`; only this file added):

- `pnpm lint` — clean
- `pnpm test` — 907 tests / 78 files, green
- `pnpm build` (`tsc -b && vite build`) — exit 0
