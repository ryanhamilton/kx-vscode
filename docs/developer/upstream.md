---
type: guide
title: Merging Upstream
description:
  How upstream KX changes enter peachq through the rebrand script, so merges
  conflict only where real code changed.
tags: [developer, upstream, rebrand]
timestamp: 2026-11-17
---

# Merging Upstream

This extension (`timestored.peachq`) is a fork of the KX extension (`KX.kdb`).
Every public id differs: commands, settings, views, the notebook type, custom
editors, language ids and product-name strings. One script owns those
differences: [`tools/rebrand.mjs`](../../tools/rebrand.mjs).

## The script

`node tools/rebrand.mjs` rewrites `package.json`, `README.md`, `src/`,
`server/src/`, `test/` and `docs/` in place. It applies an explicit table of old
to new names (`NAMESPACES`, `IDS`, `DASHED`, `LANGUAGES` and `RULES`), sets the
`package.json` metadata (`METADATA`), points the activity-bar and panel icons at
the peachq silhouette, and appends `!peachq.deferringToKx` to every keybinding
`when` clause.

It is idempotent: a second run changes nothing.

- `node tools/rebrand.mjs --check` exits 1 if it would change any file, without
  writing.
- Either mode exits 2 if `package.json` would still contribute a `kdb…` or `kx…`
  id after rewriting. Upstream has added an id the table does not know; add it
  to the table rather than editing the id by hand.

Some files must keep naming the KX extension, and the script skips them
(`EXCLUDE`): the compatibility module `src/utils/kxCompat.ts` (deferring to an
active KX extension, importing its settings, and reading workspace `kdb.*` maps
as a fallback), its tests, the fake KX extension used by the e2e suite, and this
page.

What the script deliberately leaves alone: internal TypeScript names, the
language id `q`, the file extensions `.kxnb`, `.kdb.q`, `.kxquery` and `.plot`,
the `.kx/` workbook folder, `~/.kx`, the `KX.kdb-auth` hook, factual "kdb+"
text, and marketplace or code.kx.com links.

## Workflow

1. Fetch KX's `dev`:
   `git fetch https://github.com/KxSystems/kx-vscode dev:kx-dev`
2. Branch from it: `git switch -c upstream-rebranded kx-dev`
3. Bring in our script and run it:
   `git show dev:tools/rebrand.mjs > tools/rebrand.mjs && node tools/rebrand.mjs`
4. Commit the result as one mechanical commit (the script file is identical to
   ours, so it merges cleanly).
5. Merge `upstream-rebranded` into our `dev`.

Because both sides now spell every id the same way, conflicts appear only where
real code changed. After the merge run `node tools/rebrand.mjs --check` and the
test suites; `test/suite/rebrand.test.ts` runs the same check.

Then run `node tools/headers.mjs --fix`: every file KX wrote that differs from
the fork point ends with a `Modified by peachq contributors; see NOTICE.`
comment, and a file that no longer differs loses it. `--check` (in CI and in
`test/suite/release.test.ts`) fails until that is done. Files we add carry the
peachq contributors header instead.

## Ids are never edited by hand

A `kdb.*` id written as `peachq.*` by hand is invisible to the next upstream
merge and conflicts with it. New peachq-only ids (such as `peachq.importFromKx`)
are fine; renaming an upstream id goes through the table.
