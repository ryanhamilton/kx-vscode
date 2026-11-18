---
type: guide
title: Releasing
description:
  How a version reaches the VS Code Marketplace and Open VSX through the publish
  workflow, with no stored tokens and the owner's approval.
tags: [developer, release, publishing]
timestamp: 2026-11-18
---

# Releasing

Publishing runs only in
[`.github/workflows/publish.yml`](../../.github/workflows/publish.yml), started
by hand. It holds no tokens: both stores trust the workflow through OIDC
(trusted publishing), and the step that publishes waits for the owner's approval
in the `release` environment. The workflow, the packaging scripts,
`.peachq-version` and `package.json` are code-owned by the owner
(`.github/CODEOWNERS`).

## What the workflow does

| Job       | Permissions                         | Does                                                                                                                                                                                     |
| --------- | ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `build`   | `contents: read`                    | Checks the `version` input equals `package.json`'s and runs `npm run package:targets`, which fails unless each of the 7 vsix has the right target, version, publisher and peachq binary. |
| `release` | `contents: write`                   | Creates the draft GitHub release `v<version>` with the 7 vsix, or refreshes them on a draft made from the same commit.                                                                   |
| `publish` | `id-token: write`, `contents: read` | Environment `release`. `vsce publish --oidc` and `ovsx publish --trusted-publishing`, one vsix at a time.                                                                                |

A real run (`dry_run` false) refuses a prerelease version (the Marketplace does
not take one) and any ref but `dev`. Both publish commands pass
`--skip-duplicate`, so a run that failed partway can be re-run (Re-run failed
jobs). A new dispatch of the same version from a later commit stops at the
`release` job, because packages already published would be skipped and the
version would mix two commits: bump the version instead, or, if nothing reached
either store, delete the draft first.

`dry_run` (the default) builds and checks the same files, creates a draft
release under a throwaway tag `dry-run-<run id>` and deletes it, waits for the
same approval, then prints what it would publish and the claims of the OIDC
token GitHub issues for the Marketplace (`repository`, `workflow_ref`,
`environment`; Open VSX's differs only in audience). It never exchanges that
token with a store and publishes nothing.

## Release a version

1. In a PR to `dev`: set `version` in `package.json` (no `-rc` or other
   prerelease suffix) and add its section to `CHANGELOG.md`. Merge it.
2. Actions → **Publish** → **Run workflow**, branch `dev`, `version` the new
   version, `dry_run` unticked. Leave `open_vsx` ticked, except for the first
   release (below).
3. When `publish` waits, review the run and approve it in the `release`
   environment.
4. Check the version on both stores:
   <https://marketplace.visualstudio.com/items?itemName=timestored.peachq> and
   <https://open-vsx.org/extension/timestored/peachq>. Each target (`linux-x64`,
   `linux-arm64`, `alpine-x64`, `alpine-arm64`, `darwin-arm64`, `win32-x64`) and
   the universal package should be listed.
5. Publish the draft release `v<version>` on GitHub, which creates the tag.

## The first Open VSX version

Open VSX registers a trusted publisher per extension, and only for an extension
that already exists. Its
[Trusted Publishing](https://github.com/eclipse/openvsx/wiki/Trusted-Publishing)
page:

> **The extension to exist, with at least one active version.** A trusted
> publisher is registered for an extension, so the first version has to be
> published the ordinary way, with an access token. Registrations for extensions
> that do not exist yet are rejected.

So the first release goes to Open VSX by hand, once:

1. Run the workflow as above with `open_vsx` unticked; it publishes to the
   Marketplace only.
2. Download the 7 vsix from the draft release (or the run's `vsix-<version>`
   artifact).
3. On open-vsx.org, as an owner of the `timestored` namespace with the Publisher
   Agreement signed, create an access token (Settings → Access Tokens), then on
   your own machine:

   ```sh
   for f in peachq-*.vsix; do npx ovsx@1.4.0 publish "$f" -p <token>; done
   ```

4. Delete the token straight away.
5. Settings → Trusted Publishers → namespace `timestored`, extension `peachq`:
   GitHub Actions, owner `timestored`, repository `vscode-peachq`, workflow
   `publish.yml`, environment `release`.

Every later release publishes to both stores from the workflow. The `publisher`
in `package.json` must match the namespace's case exactly (`timestored`), or
Open VSX refuses the token.

## Revoking

There is nothing to rotate: no token is stored anywhere. To stop publishing,
delete the trusted publisher on either store (Marketplace publisher settings;
open-vsx.org → Settings → Trusted Publishers), or disable the workflow
(`gh workflow disable publish.yml --repo timestored/vscode-peachq`). Do not
remove the owner from the `release` environment's reviewers: with no required
reviewer the environment stops asking, and runs publish unapproved. A token
issued to a run lasts minutes (Marketplace up to 15, Open VSX 5).
