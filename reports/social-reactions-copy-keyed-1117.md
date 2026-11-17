# Social reactions copy keyed by REACTIONS id

Fix commit: `518b443` on `main` (the report commit follows it).

## The defect

`src/components/game/socialReactions.tsx` kept the reaction labels (en
and es) and the emoji in three index-parallel arrays that merely
happened to line up with `REACTIONS` in `src/lib/social.ts`. The
component read them by position: `REACTIONS.indexOf(reaction.id)` for
the status line, `icons[i]` and `labels.labels[i]` for the picker.

Nothing tied the arrays to the ids. Adding an id to `REACTIONS` without
a matching label and icon rendered `undefined undefined` in the status
line and in the picker button, and `tsc` had nothing to say about it:
the arrays were `string[]`, so every index was legal.

## The fix

`src/lib/social.ts` now owns the visible copy next to the ids it belongs
to, keyed by id and typed exhaustively:

- `REACTION_LABELS` — `Record<Locale, Record<Reaction, string>>`
- `REACTION_ICONS` — `Record<Reaction, string>`

`socialReactions.tsx` looks up by id (`REACTION_ICONS[reaction.id]`),
and the `REACTIONS.indexOf` call is gone: an id of type `Reaction` is
always in `REACTIONS`, so the `index >= 0` guard it needed was only
covering the case the type system now forbids.

## Red-first

Adding `"cheers"` to `REACTIONS` with no label and no icon fails both
nets.

Runtime net (`pnpm exec vitest run src/lib/social.test.ts`):

```
FAIL  src/lib/social.test.ts > reaction copy > gives every REACTIONS id an icon
AssertionError: expected [ 'cheers' ] to deeply equal []
```

Compile-time net (`pnpm exec tsc -b`):

```
src/lib/social.ts(18,3): error TS2741: Property 'cheers' is missing in
  type '{ hello: string; ... }' but required in type
  'Record<"cheers" | "good_game" | ..., string>'.
src/lib/social.ts(19,3): error TS2741: ... (the Spanish table)
src/lib/social.ts(25,3): error TS2741: ... (the icon table)
```

Note for whoever runs the next gate: `pnpm exec tsc --noEmit` on the
root `tsconfig.json` is a no-op. That file is solution-style (`"files":
[]` plus project references), so it type-checks nothing and exits 0 on
a broken tree. The real type check is `tsc -b`, which `pnpm build`
runs.

## Tests

- `src/lib/social.test.ts` — the coverage guard. It derives the
  expectation from `REACTIONS` itself, so an id added without copy
  fails the suite instead of rendering `undefined`.
- `src/components/game/socialReactions.test.tsx` — the visible copy is
  pinned as literals (English and Spanish picker order, and the status
  line for a received reaction), so the keyed tables cannot quietly
  change what the player sees.

## Verification

`pnpm lint` clean; `pnpm test` green on the rebased tree that landed;
`pnpm build` (`tsc -b` + `vite build`) green.
