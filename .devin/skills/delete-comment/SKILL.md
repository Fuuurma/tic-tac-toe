---
name: delete-comment
description: "Audit code comments, remove redundant or stale ones, turn workaround notes into repair tasks, and move lasting decisions into ARCHITECTURE.md. Use for a requested…"
applies_to: ["src/", "e2e/", "scripts/", "*.config.*"]
kind: capability
---

# Delete comments

Audit the requested source scope — `src/`, `e2e/`, `scripts/`, and the root
configs pinned in `SOURCE_FILES` — including tests. Preserve the current
worktree's unrelated edits. Count comment tokens with the repo's own lexer,
never a text search: `collectComments` in `scripts/check-comments.mjs` is the
same scanner the ratchet uses, so what you classify is what the baseline
counts. A quick dump:

```sh
node --input-type=module -e '
import { inventoryAt, inventoryFiles, SOURCE_DIRS, SOURCE_FILES } from "./scripts/check-comments.mjs";
console.log(JSON.stringify({ ...inventoryAt(".", SOURCE_DIRS), ...inventoryFiles(".", SOURCE_FILES) }));'
```

For each comment, read the code it annotates and its callers before
classifying:

| Class | Test | Action |
|---|---|---|
| Tautology | The code already states the same fact | Delete |
| Stale | The described behavior or name no longer exists | Delete |
| Excuse | The note rationalizes a workaround, swallowed error, or incomplete path | File one concrete repair task (verify command included) in the lane report, keep the note until the hack is fixed, then delete it with the fix |
| Decision record | A surprising, costly-to-reverse tradeoff explains the implementation | Check ARCHITECTURE.md already carries it; if not and it is system-level, record it there, then delete the source comment |

Retain required tooling markers (`eslint-disable`, `@ts-*`,
`@vitest-environment`, `/// <reference>`, `/* global */`,
`__PRECACHE_MANIFEST__`), legal notices, and the module/API doc comments the
repo uses as its documentation convention (`/** … */` headers). Record these
separately from the four cleanup classes. When classification is uncertain,
trace the identifier or behaviour before acting — a comment that says "used
to" is usually a regression pin, not stale text.

This repo's comments are deliberately dense rationale (F-numbers, measured
dates, "the old X" stories). The expected yield is thin: delete only what
the adjacent code already states. Assertion-intent comments in e2e specs
("then this proves Y") carry meaning the selectors do not — keep them.

## Slice rules

- One area per slice (`src/lib/room-protocol/`, `src/components/`,
  `src/hooks/`, `src/game/`, `e2e/`, …). A slice owns only its files.
- Verify each slice with `pnpm lint && pnpm test && pnpm build`.
- After removals pass, run `node scripts/check-comments.mjs
  --update-baseline` to re-freeze `scripts/comment-baseline.json` at the
  lower count, then re-run the gates. The ratchet is deletion-only: it
  fails on added or changed comment lexemes, never on removals, so a
  forgotten baseline refresh cannot hide new comments — it only makes the
  `before → now` accounting stale.
- Record the audit in `reports/` (date, base sha, per-class counts,
  lines removed, follow-ups filed) so the next lane inherits the map.

## Follow-up tasks

When the corpus is too large for one slice, write area-specific follow-up
tasks into the lane report: exact file scope, the verify command
(`pnpm lint && pnpm test && pnpm build` plus the baseline refresh), and the
blocking edge (this audit's merge). Area slices are independent of each
other; baseline JSON conflicts resolve by regenerating, never by hand-editing
hashes.
