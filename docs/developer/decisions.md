---
type: reference
title: Decisions
description: Rules settled by merged pull requests, binding on later work.
tags: [developer, decisions]
---

# Decisions

## Rules

- **Strip by gutting, not by deleting call sites.** When removing an upstream subsystem, replace its internals and keep its API and callers, so upstream `dev` merges stay mechanical. This rules out deleting `ext.telemetry` usages across the codebase.
- **No marketing notifications.** The extension never raises a pop-up that markets anything (surveys, newsletters, sign-ups). Links may sit in an existing webview. This rules out reintroducing upstream nag prompts on merge.
- **Ids come from the rebrand script.** Every public id renamed from upstream (`kdb.*` → `peachq.*`, views, the notebook type, product titles) is produced by `tools/rebrand.mjs`, and upstream enters through it (`docs/developer/upstream.md`).
  - This rules out hand-editing a `kdb.*` id into `peachq.*`, and merging KX `dev` without first running the script on it.
  - Why: both sides then spell every id the same way, so merges conflict only where real code changed, and `--check` plus the rebrand test catch drift.
- **Defer to an active KX extension.** Only one of the two is ever active in a window. While `KX.kdb` is enabled (and `peachq.deferToKx` is `auto`), peachq starts no language client and its keybindings are off.
  - This rules out running both at once and silently overriding KX.
  - Why: both claim language `q`, the same files and the same shortcuts, and duplicate language servers and bindings give the user conflicting results.
