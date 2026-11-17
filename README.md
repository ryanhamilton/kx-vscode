# peachq for Visual Studio Code

q language support: run, chart and lint q against any kdb+ process, or with
built-in peachq — no licence needed.

Create and edit q files, connect to multiple q processes over kdb+ IPC, run
queries and view results as text, grids or charts.

This extension is a fork of the KX extension, published as `peachq.peachq`.

## Beside the KX extension

If the KX extension is also enabled, peachq pauses its q features (language
server and keybindings) in that window and asks once whether to keep KX or to
use peachq there instead. To move over, run **peachq: Import Connections and
Settings from the KX Extension**: it copies your user-level connections and
settings. Passwords stay in the KX extension's secret storage, so peachq asks
for each one on first connect.

## Reference

- [Reference Card](https://github.com/ryanhamilton/kx-vscode/blob/dev/docs/user/reference-card.md)
  for a list of all commands, shortcuts, and settings
- [Developer notes](https://github.com/ryanhamilton/kx-vscode/blob/dev/docs/developer/index.md),
  including
  [merging upstream](https://github.com/ryanhamilton/kx-vscode/blob/dev/docs/developer/upstream.md)

## Data and Telemetry

This extension collects no usage data and sends no telemetry.
