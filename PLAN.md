# Plan

Open q extension (`peachq.peachq`), carved from the KX fork. Staged PRs into `dev`:

1. Telemetry and KX nags out, headless test runs — PR #1 (done, b282de2d)
2. Rename to `peachq.peachq`, coexist with the KX extension, one-time import of KX settings and connections — PR #2 (done, ed41311c)
3. CI on GitHub Actions with qunit on peachq, replacing the KX workflows and quke/qcumber — PR #3, in review
4. `tools/manual-test` pointed at peachq, headless
5. Documentation links to peachq docs instead of code.kx.com
6. Bundle peachq in the vsix (per-platform packages)
7. Release: upload to timestored.com/peachq.org (dry-run default, GO=1) and the MS marketplace
8. Results text view: reuse qStudio/peachq toString renderings

## Deferred

- e2e "Executing on an Insights connection … prints to the console for the terminal" times out on `dev` as inherited from upstream (2/2 runs).
- test/suite clientCommand "should execute current block" fails when run alone, passes in the full suite (inherited).
- Marketplace itemName=KX.kdb links, code.kx.com links and package.json keywords: repoint in item 5.
- `test/q/tests/evaluatePy.quke` is unrun: its 115 checks (and 8 upstream-skipped) need PyKX.
