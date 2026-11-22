---
name: delete-comment
description: "Audit code comments in this repo: remove tautologies and stale notes, turn workaround notes into repair tasks, move lasting decisions into docs/adr/, and keep the deletion-only comment ratchet honest."
kind: capability
---

# Delete comments (tic-tac-toe)

Audit the requested scope — `src/`, `e2e/` and `scripts/`, including tests. Count
comment tokens with the repo's language-aware parser, never with a text search:
`scripts/check-comments.mjs` exports `collectComments`, `inventoryAt` and
`compareBaseline` (TypeScript scanner for JS/TS/JSX, css-tokenizer for CSS, exact
lexeme fingerprints). Inspect each comment against the surrounding code and tests
before classifying.

| Class | Test | Action |
|---|---|---|
| Tautology | The code already states the same fact | Delete |
| Stale | The described behavior or name no longer exists | Delete |
| Excuse | The note rationalizes a workaround, swallowed error, or incomplete path | File one concrete repair task in `reports/` with a verify command, then delete the note |
| Decision record | A surprising, costly-to-reverse tradeoff explains the implementation | Record it in `docs/adr/NNNN-slug.md` (see `../domain-modeling/ADR-FORMAT.md`), then trim the source comment to a pointer |

Retain required directives and API documentation: shebangs, triple-slash
reference tags, the jsdom environment pin on component tests, and JSDoc that
carries return semantics or wire contracts. This repo's comment culture is
decision-record-heavy; most `//` prose is load-bearing rationale. If
classification is uncertain, inspect call sites and history before acting.

## The ratchet

`pnpm lint` runs `node scripts/check-comments.mjs` over `SOURCE_DIRS`
(`src`, `scripts`, `e2e`). It rejects new or changed comment lexemes and allows
deletions. After a cleanup passes against the old baseline, run
`node scripts/check-comments.mjs --update-baseline`, then the full repository
gates: `pnpm lint && pnpm test && pnpm build`. Keep the ratchet moving
downward; never refresh it to admit an added comment.

Known limitation: a regex literal containing two adjacent slashes can be
mis-scanned as a line comment, so the baseline freezes phantom lexemes for a
few files. Changing such a regex fails lint with a confusing "changed comment"
message; re-freeze and note it, and prefer the follow-up task that fixes the
scanner context (tracked in reports/comment-audit-bootstrap-1122.md).

## Slice discipline

Use small reviewable slices. Give each slice its own verify command and
dependency edge. Report blocks removed, comment-only physical lines removed,
and remaining blocks, with the evidence behind any estimate. Land only the
files the slice owns. A clean area can have no secondary findings.
