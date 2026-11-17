# peachq for Visual Studio Code (probe)

An open-source VS Code extension for the q language, aimed at
peachq, a clean-room q engine that needs no licence.
"peachq" is a placeholder name for this probe.

It is a modified fork of the Apache-2.0 kdb VS Code extension by KX Systems (see `NOTICE` and `LICENSE`).
The fork removes telemetry, Insights Enterprise support and every call to KX-hosted services, and renames the extension.
It is not affiliated with or endorsed by KX Systems Inc.

Features kept: q/kdb+ IPC connections, the results grid, the chart viewer, workbooks, notebooks, query history,
the REPL, and the q language server (completion, linting, navigation).

The probe report is in [PEACHQ-PROBE.md](https://github.com/ryanhamilton/kx-vscode/blob/peachq/strip-probe/PEACHQ-PROBE.md).

## Build and test

```bash
npm ci
npm run build
npm run pretest && npm run test:headless   # unit suite in a headless VS Code (no display needed)
```

This extension sends no telemetry.
