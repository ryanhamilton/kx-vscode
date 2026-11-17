---
type: Reference
title: Reference Card
description:
  Command palette entries, keybindings, settings, execution matrix and telemetry
  events for the peachq VS Code extension.
tags: [kdb, vscode, reference, keybindings, settings, telemetry]
timestamp: 2026-10-20
---

## Command Palette

| Command                                                       | Command                                                | Command                                 |
| :------------------------------------------------------------ | :----------------------------------------------------- | :-------------------------------------- |
| peachq: Welcome                                               | peachq: New Connection                                 | peachq: Focus on Connections view       |
| peachq: Install KDB-X                                         | peachq: New Notebook                                   | peachq: Focus on Queries view           |
| peachq: Start REPL                                            | peachq: New Workbook (q)                               | peachq: Focus on Workbooks view         |
| peachq: Import Connections                                    | peachq: New Workbook (Python)                          | peachq: Focus on Query History view     |
| peachq: Export Connections                                    | peachq: New Workbook (SQL)                             | peachq: Focus on Help and Feedback view |
|                                                               | peachq: New Query                                      | peachq: Focus on peachq Results view    |
|                                                               | peachq: Convert datasources to queries                 |                                         |
| peachq: Set Notebook Row Limit (not used by the REPL)         | peachq: Show First or Last Rows (not used by the REPL) |                                         |
| peachq: Import Connections and Settings from the KX Extension |                                                        |                                         |

## Keybindings

| Command                           | When                  | Windows / Linux          | macOS            |
| :-------------------------------- | :-------------------- | :----------------------- | :--------------- |
| peachq: Execute Entire File       | `q` `py` `sql`        | `ctrl`+`shift`+`d`       | `⌘`+`⇧`+`d`      |
| peachq: Execute Current Selection | `q` `py` `sql` `kxnb` | `ctrl`+`d`               | `⌘`+`d`          |
| peachq: Execute Current Block     | `q`                   | `ctrl`+`shift`+`e`       | `⌘`+`⇧`+`e`      |
| peachq: Populate Scratchpad       | `q` `py` `sql`        | `ctrl`+`shift`+`alt`+`p` | `⌘`+`⇧`+`⌥`+`p`  |
| peachq: Reset Scratchpad          | `q` `py` `sql` `kxnb` | `ctrl`+`shift`+`delete`  | `⌘`+`⇧`+`fn`+`⌫` |
| peachq: Choose Connection         | `q` `py` `sql` `kxnb` |                          |                  |
| peachq: Choose Execution Target   | `q` `py` `sql`        | `ctrl`+`alt`+`t`         | `⌘`+`⌥`+`t`      |
| peachq: Toggle Parameter Cache    | `q`                   | `ctrl`+`shift`+`y`       | `⌘`+`⇧`+`y`      |

**Choose Connection** offers `(active)`, which runs on the connection or REPL
last used, and each open REPL by name, such as `REPL (folderA)`, which always
runs on that REPL, starting it in its folder if it is not running. A file
already assigned `REPL` keeps running on the REPL last started or focused. The
status bar names the REPL a file runs on.

In a peachq notebook cell, **Execute Current Selection** runs the selection, or
the current line when nothing is selected, and shows its result in the cell's
output. `ctrl`+`enter` runs the whole cell, as in any VS Code notebook.

A notebook table output shows at most `peachq.notebookRowLimit` rows (up to
1,000,000), the first or last as `peachq.notebookRowLimitFrom` says, with a line
giving the full row count when rows are left out. The settings are the defaults:
the notebook toolbar sets both for the open notebook only, saved in its `.kxnb`
file. The REPL ignores them.

### REPL

| Action                              | Windows / Linux   | macOS                  |
| :---------------------------------- | :---------------- | :--------------------- |
| Execute command line                | `RETURN`          | `RETURN`               |
| Delete left of cursor               | `BACKSPACE`       | `⌫`                    |
| Delete right of cursor              | `DEL`             | `fn`+`⌫`               |
| Move cursor left                    | `←` / `shift`+`←` | `←` / `⇧`+`←`          |
| Move cursor right                   | `→` / `shift`+`→` | `→` / `⇧`+`→`          |
| Recall previous history entry       | `↑`               | `↑`                    |
| Recall next history entry           | `↓`               | `↓`                    |
| Move cursor to start of line        | `HOME`            | `HOME` / `⌘`+`←`       |
| Move cursor to end of line          | `END`             | `END` / `⌘`+`→`        |
| Move cursor up (multi-line input)   | `shift`+`↑`       | `⇧`+`↑`                |
| Move cursor down (multi-line input) | `shift`+`↓`       | `⇧`+`↓`                |
| Jump to previous word               | `ctrl`+`←`        | `⌥`+`←`                |
| Jump to next word                   | `ctrl`+`→`        | `⌥`+`→`                |
| Delete previous word                | `ctrl`+`⌫`        | `⌥`+`⌫`                |
| Delete next word                    | `ctrl`+`delete`   | `⌥`+`d` (`fn`+`⌥`+`⌫`) |
| Paste code                          | `ctrl`+`v`        | `⌘`+`v`                |
| Stop execution (Reset on Windows)   | `ctrl`+`c`        | `⌃`+`c`                |
| Reset                               | `ctrl`+`d`        | `⌃`+`d`                |
| Clear the REPL                      | `ctrl`+`l`        | `⌃`+`l`                |

With `peachq.hideSourceExpressions` off, code the REPL runs from a file, a
selection or a notebook cell is shown statement by statement, each at a prompt
of its own before its output, the way a q console transcript reads. Python is
shown as written.

Pasted code is never run as it lands. A single line goes into the input at the
cursor. Several lines are shown under the prompt and held: `RETURN` runs them,
`ctrl`+`c` discards them (and stops a running query), and a further paste adds
to them. Whether a right click pastes is VS Code's
`terminal.integrated.rightClickBehavior` setting.

## Settings

| Setting                                               | Scope               | Type      | Default       |
| :---------------------------------------------------- | :------------------ | :-------- | :------------ |
| [peachq.qHomeDirectory](q-home-directory.md)          | machine             | `string`  | `""`          |
| peachq.servers                                        | machine             | `object`  | `{}`          |
| peachq.insightsEnterpriseConnections                  | machine             | `object`  | `{}`          |
| peachq.connectionLabels                               | machine             | `array`   | `[]`          |
| peachq.labelsConnectionMap                            | machine             | `array`   | `[]`          |
| peachq.hideSourceExpressions                          | machine             | `boolean` | `true`        |
| peachq.neverShowQInstallAgain                         | machine             | `boolean` | `false`       |
| peachq.autoFocusOutputOnEntry                         | machine             | `boolean` | `true`        |
| peachq.notebookRowLimit                               | machine-overridable | `number`  | `100`         |
| peachq.notebookRowLimitFrom                           | machine-overridable | `string`  | `"first"`     |
| [peachq.qHomeDirectoryWorkspace](q-home-directory.md) | resource            | `string`  | `""`          |
| peachq.connectionMap                                  | resource            | `object`  | `{}`          |
| peachq.targetMap                                      | resource            | `object`  | `{}`          |
| peachq.timeoutMap                                     | resource            | `object`  | `{}`          |
| peachq.defaultTimeout                                 | resource            | `number`  | `30`          |
| peachq.linting                                        | resource            | `boolean` | `false`       |
| peachq.refactoring                                    | resource            | `string`  | `"Workspace"` |
| peachq.deferToKx                                      | window              | `string`  | `"auto"`      |

`peachq.connectionMap`, `peachq.targetMap` and `peachq.timeoutMap` are keyed by
workspace relative path, so they only cover files inside the workspace. Files
opened from outside the workspace can still be assigned a connection, an
execution target and a timeout, but those assignments are kept in memory and are
lost when VS Code restarts.

### Beside the KX extension

When the KX extension is enabled in the same window, peachq defers to it while
`peachq.deferToKx` is `auto`: it does not start its language server, its
keybindings are off, and a status bar item says it is paused. It asks once per
workspace whether to use peachq instead (which opens the KX extension's page so
you can disable it for the workspace) or keep KX. With `peachq.deferToKx` set to
`never` peachq stays on regardless, and both extensions then claim the same
files and keys.

**Import Connections and Settings from the KX Extension** copies your user-level
`kdb.*` settings to the `peachq.*` ones you have not set; peachq offers it at
startup while there is something to import, until you import or choose Never.
Passwords stay in the KX extension's secret storage, so peachq asks for each on
first connect. A workspace whose settings still map files under the KX
extension's names (its connection, target and timeout maps) keeps working:
peachq reads those entries for any file its own maps do not mention.

## Execution

| Type                | REPL | My q | IE SP | IE q/SQL | IE API | IE UDA | IE Populate SP |
| :------------------ | :--: | :--: | :---: | :------: | :----: | :----: | :------------: |
| File `q`            |  ✓   |  ✓   |   ✓   |    ✓     |        |        |       ✓        |
| File `quke`         |  ✓   |  ✓   |   ✓   |    ✓     |        |        |                |
| File `py`           |  ✓   |  ✓   |   ✓   |    ✓     |        |        |       ✓        |
| File `sql`          |  ✓   |  ✓   |       |    ✓     |        |        |       ✓        |
| Workbook `q`        |  ✓   |  ✓   |   ✓   |    ✓     |        |        |       ✓        |
| Workbook `py`       |  ✓   |  ✓   |   ✓   |    ✓     |        |        |       ✓        |
| Workbook `sql`      |  ✓   |  ✓   |       |    ✓     |        |        |       ✓        |
| Notebook Cell `q`   |  ✓   |  ✓   |   ✓   |    ✓     |        |        |       ✓        |
| Notebook Cell `py`  |  ✓   |  ✓   |   ✓   |    ✓     |        |        |       ✓        |
| Notebook Cell `sql` |  ✓   |  ✓   |       |    ✓     |        |        |       ✓        |
| Query               |      |      |       |    ✓     |   ✓    |   ✓    |       ✓        |

`REPL` and `My q` requires [PyKX](use-pykx-within-repl.md) for Python support.

`quke` files support selection and current line execution only — there is no
whole file run.

## Telemetry

No telemetry leaves the machine: the extension has no reporter. The events below
are only written to the `telemetry-client-test` output channel when `CODE_TEST`
is set.

| Telemetry                         | Measurements | Source                                   |
| :-------------------------------- | :----------: | :--------------------------------------- |
| Extension.Activated               |              | src/extension.ts                         |
| Extension.CustomAuth.Activated    |              | src/extension.ts                         |
| ¦                                 |              |                                          |
| Welcome.Displayed                 |              | src/commands/setupCommand.ts             |
| Install.kdbx                      |              | src/commands/setupCommand.ts             |
| Install.kdbx.workspace            |              | src/commands/setupCommand.ts             |
| Install.kdbx.win32.fail           |              | src/commands/setupCommand.ts             |
| Repl.Start                        |              | src/commands/workspaceCommand.ts         |
| Repl.StartFolder                  |              | src/commands/workspaceCommand.ts         |
| ¦                                 |              |                                          |
| Connection.Create.kdb             |              | src/commands/serverCommand.ts            |
| Connection.Edit.kdb               |              | src/commands/serverCommand.ts            |
| Connection.Delete.kdb             |              | src/services/connectionManagerService.ts |
| Connection.Create.ie              |              | src/commands/serverCommand.ts            |
| Connection.Edit.ie                |              | src/commands/serverCommand.ts            |
| Connection.Delete.ie              |              | src/services/connectionManagerService.ts |
| Connection.Export.All             |              | src/extension.ts                         |
| Connection.Export.Single          |              | src/extension.ts                         |
| Connection.Import                 |              | src/extension.ts                         |
| Connection.Cancel.ie.sp           |              | src/classes/insightsConnection.ts        |
| Connection.Reset.ie.sp            |              | src/classes/insightsConnection.ts        |
| Connection.Label.Create           |      ✓       | src/utils/connLabel.ts                   |
| Connection.Label.Delete           |      ✓       | src/utils/connLabel.ts                   |
| ¦                                 |              |                                          |
| Run.Workbook.repl.q               |              | src/utils/queryUtils.ts                  |
| Run.Workbook.repl.py              |              | src/utils/queryUtils.ts                  |
| Run.Workbook.repl.sql             |              | src/utils/queryUtils.ts                  |
| Run.File.repl.q                   |              | src/utils/queryUtils.ts                  |
| Run.File.repl.quke                |              | src/utils/queryUtils.ts                  |
| Run.File.repl.py                  |              | src/utils/queryUtils.ts                  |
| Run.File.repl.sql                 |              | src/utils/queryUtils.ts                  |
| Run.Cell.repl.q                   |              | src/utils/queryUtils.ts                  |
| Run.Cell.repl.py                  |              | src/utils/queryUtils.ts                  |
| Run.Cell.repl.sql                 |              | src/utils/queryUtils.ts                  |
| ¦                                 |              |                                          |
| Run.Workbook.kdb.q                |              | src/utils/queryUtils.ts                  |
| Run.Workbook.kdb.py               |              | src/utils/queryUtils.ts                  |
| Run.Workbook.kdb.sql              |              | src/utils/queryUtils.ts                  |
| Run.File.kdb.q                    |              | src/utils/queryUtils.ts                  |
| Run.File.kdb.quke                 |              | src/utils/queryUtils.ts                  |
| Run.File.kdb.py                   |              | src/utils/queryUtils.ts                  |
| Run.File.kdb.sql                  |              | src/utils/queryUtils.ts                  |
| Run.Cell.kdb.q                    |              | src/utils/queryUtils.ts                  |
| Run.Cell.kdb.py                   |              | src/utils/queryUtils.ts                  |
| Run.Cell.kdb.sql                  |              | src/utils/queryUtils.ts                  |
| ¦                                 |              |                                          |
| Run.Workbook.ie.q                 |              | src/utils/queryUtils.ts                  |
| Run.Workbook.ie.py                |              | src/utils/queryUtils.ts                  |
| Run.Workbook.ie.sql               |              | src/utils/queryUtils.ts                  |
| Run.File.ie.q                     |              | src/utils/queryUtils.ts                  |
| Run.File.ie.quke                  |              | src/utils/queryUtils.ts                  |
| Run.File.ie.py                    |              | src/utils/queryUtils.ts                  |
| Run.File.ie.sql                   |              | src/utils/queryUtils.ts                  |
| Run.Cell.ie.q                     |              | src/utils/queryUtils.ts                  |
| Run.Cell.ie.py                    |              | src/utils/queryUtils.ts                  |
| Run.Cell.ie.sql                   |              | src/utils/queryUtils.ts                  |
| ¦                                 |              |                                          |
| Run.Workbook.ie.dap.q             |              | src/utils/queryUtils.ts                  |
| Run.Workbook.ie.dap.py            |              | src/utils/queryUtils.ts                  |
| Run.File.ie.dap.q                 |              | src/utils/queryUtils.ts                  |
| Run.File.ie.dap.quke              |              | src/utils/queryUtils.ts                  |
| Run.File.ie.dap.py                |              | src/utils/queryUtils.ts                  |
| Run.Cell.ie.dap.q                 |              | src/utils/queryUtils.ts                  |
| Run.Cell.ie.dap.py                |              | src/utils/queryUtils.ts                  |
| ¦                                 |              |                                          |
| Run.Workbook.kdb.quick.q          |              | src/utils/queryUtils.ts                  |
| Run.Workbook.kdb.quick.py         |              | src/utils/queryUtils.ts                  |
| Run.Workbook.kdb.quick.sql        |              | src/utils/queryUtils.ts                  |
| Run.File.kdb.quick.q              |              | src/utils/queryUtils.ts                  |
| Run.File.kdb.quick.quke           |              | src/utils/queryUtils.ts                  |
| Run.File.kdb.quick.py             |              | src/utils/queryUtils.ts                  |
| Run.File.kdb.quick.sql            |              | src/utils/queryUtils.ts                  |
| Run.Cell.kdb.quick.q              |              | src/utils/queryUtils.ts                  |
| Run.Cell.kdb.quick.py             |              | src/utils/queryUtils.ts                  |
| Run.Cell.kdb.quick.sql            |              | src/utils/queryUtils.ts                  |
| ¦                                 |              |                                          |
| Run.Datasource.api                |              | src/utils/queryUtils.ts                  |
| Run.Datasource.qsql               |              | src/utils/queryUtils.ts                  |
| Run.Datasource.sql                |              | src/utils/queryUtils.ts                  |
| Run.Datasource.uda                |              | src/utils/queryUtils.ts                  |
| ¦                                 |              |                                          |
| Populate.Datasource.api           |              | src/utils/queryUtils.ts                  |
| Populate.Datasource.qsql          |              | src/utils/queryUtils.ts                  |
| Populate.Datasource.sql           |              | src/utils/queryUtils.ts                  |
| Populate.Datasource.uda           |              | src/utils/queryUtils.ts                  |
| ¦                                 |              |                                          |
| Populate.Workbook.ie.q            |              | src/utils/queryUtils.ts                  |
| Populate.Workbook.ie.py           |              | src/utils/queryUtils.ts                  |
| Populate.Workbook.ie.sql          |              | src/utils/queryUtils.ts                  |
| Populate.File.ie.q                |              | src/utils/queryUtils.ts                  |
| Populate.File.ie.py               |              | src/utils/queryUtils.ts                  |
| Populate.File.ie.sql              |              | src/utils/queryUtils.ts                  |
| Populate.Cell.ie.q                |              | src/utils/queryUtils.ts                  |
| Populate.Cell.ie.py               |              | src/utils/queryUtils.ts                  |
| Populate.Cell.ie.sql              |              | src/utils/queryUtils.ts                  |
| ¦                                 |              |                                          |
| Results.Table.Displayed           |              | src/services/resultsPanelProvider.ts     |
| Results.Export.csv                |              | src/services/resultsPanelProvider.ts     |
| Results.Graphics.Displayed.kdb.q  |              | src/commands/serverCommand.ts            |
| Results.Graphics.Displayed.kdb.py |              | src/commands/serverCommand.ts            |
| Results.Graphics.Displayed.ie.q   |              | src/commands/serverCommand.ts            |
| Results.Graphics.Displayed.ie.py  |              | src/commands/serverCommand.ts            |
| Results.Graphics.Displayed.ie.ws  |              | src/classes/scratchpadLogger.ts          |
| ¦                                 |              |                                          |
| Language.References               |              | server/src/qLangServer.ts                |
| Language.Definition               |              | server/src/qLangServer.ts                |
| Language.Completion               |              | server/src/qLangServer.ts                |
| Language.RenameRequest            |              | server/src/qLangServer.ts                |
| Language.ParameterCache           |              | server/src/qLangServer.ts                |
| Language.CallHierarchy            |              | server/src/qLangServer.ts                |
| ¦                                 |              |                                          |
| Help.Open.Documentation           |              | src/extension.ts                         |
| Help.Open.ReportBug               |              | src/extension.ts                         |
| Help.Open.SuggestFeature          |              | src/extension.ts                         |
