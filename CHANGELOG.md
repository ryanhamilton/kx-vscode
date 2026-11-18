# Change log

All notable changes to **peachq** are documented in this file.

## 1.30.0 — Unreleased

Forked from KX's kdb VS Code extension (1.21.0 + dev at 654ea443); upstream
history: https://github.com/KxSystems/kx-vscode/blob/main/CHANGELOG.md

- No telemetry: the Application Insights reporter, the survey and the newsletter
  prompts are gone, and bug and feature links point at this fork.
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
- Query results always reach the console, and tables, dictionaries and keyed
  tables also reach the Results view without taking focus
  (`peachq.results.grid`: `always` or `never`); the Terminal / Results View
  toolbar switch is gone. A process without the `.vscode` namespace is sent
  qStudio's wrapper, so the console shows the process's own `.Q.s` text and the
  grid typed values; each connection has a Query mode (`auto`, `naked`,
  `qstudio-wrap`, `vscode-wrap`). The first such run from code under `\d .ns`
  asks whether runs from namespaced files go to the file's namespace or run as
  typed, and keeps the answer with the connection (Namespaced runs). The status
  bar and the **Run on** lens name the connection or REPL an unassigned file
  runs on.
- **Execute Entire File** on a q file is now **Execute Whole File as if loaded
  with \l**: it always sends the file through upstream's evaluate lambda,
  unmodified (or the `.vscode` API), in the file's namespace and without asking,
  except on a `naked` connection. Run the whole file the default way by
  selecting it all. `npm run test:l-diff` compares it with `\l` on peachq over
  48 scripts; the differences are listed in the reference card. The hints after
  a failed multi-line or namespaced run name the command.
- Every peachq the extension starts runs with `peachq.peachqArgs`, by default
  `-classic`.
- The REPL starts q in quiet mode (`-q`), so piped input is not echoed back with
  a `q)` prompt, and an error in a query is printed with its backtrace and no
  longer leaves the REPL waiting: the next query runs.
- Licensed Apache-2.0 in `package.json` (it said MIT, an upstream slip; the
  code always was Apache-2.0), with a `NOTICE` in every package naming the KX
  work this is modified from, the bundled third-party code and the trademarks.
  Files added since the fork carry a peachq contributors header; KX's files
  keep KX's.
- Version 1.30.0, a new README for the marketplace page, and product wording
  in settings and docs that names q, not kdb.
