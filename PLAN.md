# Plan

Open q extension (`peachq.peachq`), carved from the KX fork. Staged PRs into `dev`:

1. Telemetry and KX nags out, headless test runs — PR #1 (done, b282de2d)
2. Rename to `peachq.peachq`, coexist with the KX extension, one-time import of KX settings and connections — PR #2 (done, ed41311c)
3. CI on GitHub Actions with qunit on peachq, replacing the KX workflows and quke/qcumber — PR #3 (done, 765d0b80)
4. `tools/manual-test` pointed at peachq, headless — PR #4 (done, 4fef5c98)
5. Documentation links to peachq docs instead of code.kx.com, wording and a fresh CHANGELOG — PR #5 (done, 26f5eafb)
6. Bundle peachq in the vsix (per-platform packages) — PR #6
7. Release: upload to timestored.com/peachq.org (dry-run default, GO=1) and the MS marketplace
8. Results text view: reuse qStudio/peachq toString renderings
9. Import from jshinonome's vscode-q: read its server list (format from the MIT 2.4.6 code, e.g. Yanpas/vscode-q), offered like the KX import. Its marketplace listing has the most installs of any q extension (15k).

## Deferred

- e2e "Executing on an Insights connection … prints to the console for the terminal" times out on `dev` as inherited from upstream (2/2 local runs and in CI); pending (`it.skip`) in `test/e2e/insights.test.ts`.
- test/suite clientCommand "should execute current block" fails when run alone, passes in the full suite (inherited).
- `test/q/tests/evaluatePy.quke` is unrun: its 115 checks (and 8 upstream-skipped) need PyKX.

## Final review

The owner's hands-on VS Code pass at the end of the programme, for what no one has eyeballed yet:

- Logo and activity-bar icon in light and dark themes.
- The "KX extension is active" status-bar item and its prompt.
- The KX import pop-up.
- The first-connect password prompt.
- Results grid and chart rendering against peachq (the headless walkthrough reads the grid's text, not its look).
- Welcome page peachq section and wording.
- Built-in peachq connection: start/stop, appears only in targeted packages.
