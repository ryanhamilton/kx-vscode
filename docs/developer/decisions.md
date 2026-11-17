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
