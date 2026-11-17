# Change log

All notable changes to **peachq** are documented in this file.

## Unreleased

Forked from KX's kdb VS Code extension (1.21.0 + dev at 654ea443); upstream
history: https://github.com/KxSystems/kx-vscode/blob/main/CHANGELOG.md

- No telemetry: the Application Insights reporter, the survey and the
  newsletter prompts are gone, and bug and feature links point at this fork.
- Published as `peachq.peachq` with `peachq.*` settings and commands. While the
  KX extension is enabled in a window, peachq pauses its q features there, and
  it offers a one-time import of the KX extension's connections and settings.
- CI on GitHub Actions: build, unit, e2e and the injected q code tested with
  qunit on peachq, plus CodeQL and dependabot.
- `tools/manual-test` runs on peachq only, headless when `HEADLESS` is set.
- Wording names q rather than kdb where it means any q process, TLS help links
  to the peachq IPC page, and the welcome page has a "Run q with peachq"
  section.
- Packages for Linux (x64, arm64), macOS (Apple silicon) and Windows (x64)
  bundle peachq, pinned and checksummed at build time, plus a universal package
  without it. The connections panel lists **peachq (built-in)**, which starts
  that peachq on `127.0.0.1` with a one-off password on connect and stops it on
  disconnect. The REPL falls back to it only when no other q is found.
