# Plan

Open q extension (`peachq.peachq`), carved from the KX fork. Staged PRs into `dev`:

1. Telemetry and KX nags out, headless test runs — PR #1 (done, b282de2d)
2. Rename to `peachq.peachq`, coexist with the KX extension, one-time import of KX settings and connections — PR #2 (done, ed41311c)
3. CI on GitHub Actions with qunit on peachq, replacing the KX workflows and quke/qcumber — PR #3 (done, 765d0b80)
4. `tools/manual-test` pointed at peachq, headless — PR #4 (done, 4fef5c98)
5. Documentation links to peachq docs instead of code.kx.com, wording and a fresh CHANGELOG — PR #5 (done, 26f5eafb)
6. Bundle peachq in the vsix (per-platform packages) — PR #6 (done, 06ee445d)
7. REPL on peachq: contract suite against real peachq, quiet start, errors no longer stall the REPL — PR #7 (done, 96f284d5)
8. Query sending and results (owner design, 2026-11-17): default run (line/selection/file) uses the `.vscode` API when the server has it, else a qStudio-style wrapper (`value` as-is, `.Q.trp`, `-22!` cap, returns typed value + `.Q.s` text); upstream's "Execute Entire File" is relabelled "Execute Whole File as if loaded with \l" and uses the KX wrapper (statement split, `\` lines, context); per-server override `qstudio-wrap | vscode-wrap | as-is`; on failures that look like script semantics, a console hint pointing at the whole-file command or the per-server `vscode-wrap` override + GitHub link. Results always render both: console gets the server's `.Q.s` text, tables also go to the grid (typed value, TypeScript cell formatter, no focus steal). `peachq.peachqArgs` default `["-classic"]` for every peachq the extension starts. Next after the final review. PR A0 done (#10, 896e0035). PR A done (#11, 2c998f7b). PR B (#12): whole-file command relabel + `\l` differential (`npm run test:l-diff`). Details: [actionable-plans/2026-11-17-query-sending.md](actionable-plans/2026-11-17-query-sending.md).
9. Charts: a chart builder for table results (qStudio/Pulse-style, no PyKX needed); today a chart is only a PNG the query itself returns.
10. Release: upload to timestored.com/peachq.org (dry-run default, GO=1) and the MS marketplace
11. Import from jshinonome's vscode-q: read its server list (format from the MIT 2.4.6 code, e.g. Yanpas/vscode-q), offered like the KX import. Its marketplace listing has the most installs of any q extension (15k).

## Deferred

- e2e "Executing on an Insights connection … prints to the console for the terminal" times out on `dev` as inherited from upstream (2/2 local runs and in CI); pending (`it.skip`) in `test/e2e/insights.test.ts`.
- test/suite clientCommand "should execute current block" fails when run alone, passes in the full suite (inherited).
- REPL results in the grid (item 8): the REPL talks to q over stdin/stdout text only, so it has no typed value to give the grid without a second, IPC channel to the same q; deferred until that is worth adding.
- Insights results before 1.12 (item 8): their table view is not structured text, so they still go to the grid alone, revealed, with a pointer in the console.
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
- REPL against bundled peachq.
