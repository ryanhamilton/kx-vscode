# Plan

Open q extension (`peachq.peachq`), carved from the KX fork. Staged PRs into `dev`:

1. Telemetry and KX nags out, headless test runs — PR #1 (done, b282de2d)
2. Rename to `peachq.peachq`, coexist with the KX extension, one-time import of KX settings and connections
3. CI on GitHub Actions with qunit on peachq, replacing the KX workflows and quke/qcumber
4. `tools/manual-test` pointed at peachq, headless
5. Documentation links to peachq docs instead of code.kx.com

## Deferred

- e2e "Executing on an Insights connection … prints to the console for the terminal" times out on `dev` as inherited from upstream (2/2 runs).
