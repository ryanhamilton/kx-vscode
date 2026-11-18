---
type: Reference
title: Reference Card
description:
  Command palette entries, keybindings, settings, execution matrix and telemetry
  events for the peachq VS Code extension.
tags: [kdb, vscode, reference, keybindings, settings, telemetry]
timestamp: 2026-11-18
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

| Command                                         | When                  | Windows / Linux          | macOS            |
| :---------------------------------------------- | :-------------------- | :----------------------- | :--------------- |
| peachq: Execute Whole File as if loaded with \l | `q` `sql`             | `ctrl`+`shift`+`d`       | `⌘`+`⇧`+`d`      |
| peachq: Execute Entire File                     | `py`                  | `ctrl`+`shift`+`d`       | `⌘`+`⇧`+`d`      |
| peachq: Execute Current Selection               | `q` `py` `sql` `kxnb` | `ctrl`+`d`               | `⌘`+`d`          |
| peachq: Execute Current Block                   | `q`                   | `ctrl`+`shift`+`e`       | `⌘`+`⇧`+`e`      |
| peachq: Populate Scratchpad                     | `q` `py` `sql`        | `ctrl`+`shift`+`alt`+`p` | `⌘`+`⇧`+`⌥`+`p`  |
| peachq: Reset Scratchpad                        | `q` `py` `sql` `kxnb` | `ctrl`+`shift`+`delete`  | `⌘`+`⇧`+`fn`+`⌫` |
| peachq: Choose Connection                       | `q` `py` `sql` `kxnb` |                          |                  |
| peachq: Choose Execution Target                 | `q` `py` `sql`        | `ctrl`+`alt`+`t`         | `⌘`+`⌥`+`t`      |
| peachq: Toggle Parameter Cache                  | `q`                   | `ctrl`+`shift`+`y`       | `⌘`+`⇧`+`y`      |

**Choose Connection** offers `(active)`, which runs on the connection or REPL
last used (the status bar and the file's **Run on** lens name which, such as
`(active: REPL)`), and each open REPL by name, such as `REPL (folderA)`, which
always runs on that REPL, starting it in its folder if it is not running. A file
already assigned `REPL` keeps running on the REPL last started or focused. The
status bar names the REPL a file runs on. In a package that bundles peachq it
also offers `peachq (built-in)`, which starts that peachq on `127.0.0.1` when
connected.

### Query results

A run (line, selection or block; to run the whole file this way, select it all)
prints its result in the connection's console, always, and also puts a table,
dictionary or keyed table in the peachq Results view without bringing it to the
front or taking focus; `peachq.results.grid` set to `never` keeps the grid out
of it. What is sent depends on the connection's **Query mode** (Advanced, in the
connection form):

| Query mode     | Sends                                                                                          | Console                  | Grid                       |
| :------------- | :--------------------------------------------------------------------------------------------- | :----------------------- | :------------------------- |
| `auto`         | the `.vscode` API when the process has it, else qStudio's wrapper                              | as the row it picks      | as the row it picks        |
| `qstudio-wrap` | qStudio's wrapper around your text, as one string (`value`, `.Q.trp`, a 10 MB `-22!` grid cap) | the process's `.Q.s`     | typed values               |
| `naked`        | exactly your text                                                                              | q's console text of it   | typed values               |
| `vscode-wrap`  | the `.vscode` API when the process has it, else the evaluate lambda                            | laid out from the result | structured text built in q |

A result over 10 MB is shown as text only and the grid says so. A multi-line run
sent as one expression that fails prints one line pointing at the whole-file
command and `vscode-wrap`.

**Execute Whole File as if loaded with \l** on a q file sends the file through
the evaluate lambda unmodified from upstream (or the `.vscode` API when the
process has it), in the namespace of a `\d` at the top of the file, whatever the
Query mode, except `naked`, which sends the file's text as it is. It never asks
about namespaces. The console shows the last value, the grid the table,
dictionary or keyed table. On a `sql` file it runs the SQL as before, and on a
REPL or an Insights connection it sends what it always has.

Measured against `\l` on peachq (`npm run test:l-diff`, 48 scripts:
`test/fixtures/l-diff/expected.tsv`), it leaves the same names, values and
namespace behind, and fails with the same error at the same line, except:

| Loaded with `\l`                                               | Whole-file command                                        |
| :------------------------------------------------------------- | :-------------------------------------------------------- |
| prints the value of every expression that does not end in `;`  | shows only the last one, as the run's result              |
| stops at a lone `\` after a closed `/` … `\` block comment     | runs on past it                                           |
| on an error, stays in the `\d` the script had reached (peachq) | always puts the namespace back to where it was            |
| keeps comments inside a multi-line function in its source text | drops them from the source text; the function is the same |
| names the error's file and line                                | names the statement that failed                           |

It also defines `.axq.i_PRIMCODE` and `.axq.i_NONPRIMCODE` on the server, and a
script that ends with an assignment shows `::` on peachq, which answers `::` for
the assignment the lambda wraps in `;[::;…]`.

qStudio's wrapper has no namespace, so the first `auto` run from code under
`\d .foo` asks how runs from namespaced files should work on that connection:
**Run in the file's namespace** sends them through the `.vscode` API or the
evaluate lambda in `.foo`; **Run as typed (root namespace)** keeps qStudio's
wrapper and prints a line saying the run was in the root namespace. The answer
is kept with the connection as **Namespaced runs** (`ask`, `file-namespace`,
`as-typed`; Advanced, in the connection form). Runs from the root namespace are
unchanged and never ask. Running `\d` or `system "d …"` itself through a wrapped
run changes the server's namespace for every later query.

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

| Setting                                               | Scope               | Type      | Default        |
| :---------------------------------------------------- | :------------------ | :-------- | :------------- |
| [peachq.qHomeDirectory](q-home-directory.md)          | machine             | `string`  | `""`           |
| peachq.servers                                        | machine             | `object`  | `{}`           |
| peachq.insightsEnterpriseConnections                  | machine             | `object`  | `{}`           |
| peachq.connectionLabels                               | machine             | `array`   | `[]`           |
| peachq.labelsConnectionMap                            | machine             | `array`   | `[]`           |
| peachq.hideSourceExpressions                          | machine             | `boolean` | `true`         |
| peachq.neverShowQInstallAgain                         | machine             | `boolean` | `false`        |
| peachq.autoFocusOutputOnEntry                         | machine             | `boolean` | `true`         |
| peachq.results.grid                                   | machine             | `string`  | `"always"`     |
| peachq.peachqArgs                                     | machine             | `array`   | `["-classic"]` |
| peachq.notebookRowLimit                               | machine-overridable | `number`  | `100`          |
| peachq.notebookRowLimitFrom                           | machine-overridable | `string`  | `"first"`      |
| [peachq.qHomeDirectoryWorkspace](q-home-directory.md) | resource            | `string`  | `""`           |
| peachq.connectionMap                                  | resource            | `object`  | `{}`           |
| peachq.targetMap                                      | resource            | `object`  | `{}`           |
| peachq.timeoutMap                                     | resource            | `object`  | `{}`           |
| peachq.defaultTimeout                                 | resource            | `number`  | `30`           |
| peachq.linting                                        | resource            | `boolean` | `false`        |
| peachq.lint.enabled                                   | window              | `boolean` | `true`         |
| peachq.lint.qPath                                     | window              | `string`  | `""`           |
| peachq.refactoring                                    | resource            | `string`  | `"Workspace"`  |
| peachq.deferToKx                                      | window              | `string`  | `"auto"`       |

`peachq.peachqArgs` is added to every peachq the extension starts: the built-in
connection, and the REPL when it runs the bundled peachq. It is never passed to
a q of your own.

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
