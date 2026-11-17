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
- **CI never touches KX.** No KX q, image, registry, token or licence in any workflow. The only q in CI is a pinned, checksummed peachq (`.peachq-version` through `peachq-org/setup-peachq`, pinned by SHA). This rules out reviving the qcumber/qpbuild job or any KX secret, because the project must build and test with nothing anyone needs a KX licence for.
- **q code is tested with qunit on peachq.** The q the extension injects is tested by `test/q/qunit/*Test.q` through `test/q/run.q`, which refuses non-peachq q and exits non-zero on failure. When peachq diverges from documented kdb, the test stays as a `skip*` with a reason and a NOTES-FOR-PEACHQ line. The expectation is never bent. This rules out editing an expected value to make peachq pass, because the expectations are kdb's contract with end users, who may run KX q.
- **Manual testing is peachq-only and headless for agents.** `qserver.ts` starts only a q that answers `.pq.version`, and agents run the driver with `HEADLESS=1` and `DISPLAY`/`WAYLAND_DISPLAY` unset, never `--headed`; a human may pass it. This rules out pointing the tool at KX q and agents opening windows on a developer's display. Why: rule zero, and agent runs must not take over the owner's screen.
