# Approved project rollout

This procedure applies only to a claimed, owner-requested foundation rollout
for a named repository on its owning Mac. It does not authorize remote work,
new products, new schedulers, product-code changes, or global installs.

1. Identify `FLEET_TAG` and read the project's hub state and local `AGENTS.md`.
   Confirm the repository belongs to this Mac. Inspect dirty/staged paths and
   existing skills; preserve all unrelated work.
2. Read the hub's `mattpocock-source.json`. Verify the source files against its
   local hashes before copying. A mismatch or missing file is a blocker, not
   permission to fetch a newer version.
3. Copy these complete directories from the hub's `.devin/skills/` into the
   project's `.devin/skills/`: `tdd`, `diagnosing-bugs`, `codebase-design`,
   `domain-modeling`, `writing-for-agents`, `retro`, `hub-foundation`, and
   `hub-knowledge-curation`. Include the manifest. Retain bundled MIT notices
   and relative references. Preserve `retro`'s user-only triggers.
4. If an existing skill with the same name differs, stop and report the
   conflict. Do not overwrite, merge, or install a second discovery-path
   version. An identical copy is already installed.
5. Add the exact block below to the existing `AGENTS.md`, once. Do not replace
   generated Convex sections, existing comments, stack rules, or design skills.
   The only permitted instruction change is this pre-authored block.
6. Validate names/frontmatter, relative references, provenance hashes, and
   user-only retrospective metadata. Verify that the next session's harness
   discovers these paths; where it cannot, retain explicit file-read fallback.
   Do not claim installation merely because an AGENTS pointer exists.
7. Run the repo's existing applicable documentation checks and diff hygiene.
   Record install paths, source pin, discovery evidence, and actual checks in
   the project's existing hub finding record. Complete the claim only after
   the files and pointer are present; code changes require a separate task.

## Exact AGENTS block

```markdown
### Engineering foundation

Before implementation, debugging, architecture work, agent-instruction edits,
or knowledge curation, invoke `hub-foundation` from `.devin/skills/`.
If the harness cannot invoke it, read `.devin/skills/hub-foundation/SKILL.md`
explicitly and follow only the references relevant to the approved task.
The foundation supplements this repository's rules; it grants no additional
permissions. `retro` is owner-invoked, and raw session history stays local.
Provenance: `.devin/skills/mattpocock-source.json`.
```
