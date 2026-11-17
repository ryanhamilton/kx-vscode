/*
 * Copyright (c) 1998-2026 KX Systems Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the
 * License. You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations under the License.
 */

import * as crypto from "crypto";
import * as vscode from "vscode";

import { getCellKind } from "./notebookProviders";
import { LocalConnection } from "../classes/localConnection";
import { ReplConnection } from "../classes/replConnection";
import { contextAbove, executeQuery } from "../commands/serverCommand";
import {
  reportReplError,
  resolveRunTarget,
} from "../commands/workspaceCommand";
import { ext } from "../extensionVariables";
import { CellKind } from "../models/notebook";
import { getBasename, isQuickAlias } from "../utils/core";
import { MessageKind, notify } from "../utils/notifications";
import { registerImageTarget } from "../utils/plotUtils";
import {
  resultToBase64,
  getPythonWrapper,
  getSQLWrapper,
  notifyExecution,
  RunFlag,
} from "../utils/queryUtils";
import {
  convertToGrid,
  escapeHtml,
  formatResult,
} from "../utils/resultsRenderer";

const logger = "notebookController";

export class KxNotebookController {
  readonly controllerId = "peachq-notebook-1";
  readonly notebookType = "peachq-notebook";
  readonly label = "peachq Notebook";
  readonly supportedLanguages = ["q", "python", "sql"];

  protected readonly controller: vscode.NotebookController;
  protected readonly selections = new WeakMap<
    vscode.NotebookCell,
    { text: string; context: string }
  >();
  protected readonly running = new Set<vscode.NotebookCell>();
  protected order = 0;

  constructor() {
    this.controller = vscode.notebooks.createNotebookController(
      this.controllerId,
      this.notebookType,
      this.label,
    );
    this.controller.supportedLanguages = this.supportedLanguages;
    this.controller.supportsExecutionOrder = true;
    this.controller.executeHandler = this.execute.bind(this);
  }

  dispose(): void {
    this.controller.dispose();
  }

  findCell(editor?: vscode.TextEditor) {
    if (editor?.document.uri.scheme !== "vscode-notebook-cell")
      return undefined;
    for (const notebook of vscode.workspace.notebookDocuments) {
      if (notebook.notebookType !== this.notebookType) continue;
      const cell = notebook
        .getCells()
        .find((cell) => cell.document === editor.document);
      if (cell) return cell;
    }
    return undefined;
  }

  async executeSelection(
    editor = vscode.window.activeTextEditor,
    cell = this.findCell(editor),
  ) {
    if (!editor || !cell) return;

    const text = editor.selection.isEmpty
      ? editor.document.lineAt(editor.selection.active.line).text
      : editor.document.getText(editor.selection);
    if (!text.trim()) return;

    if (this.running.has(cell) || this.selections.has(cell)) {
      notify(
        `Cell ${cell.index + 1} of ${getBasename(cell.notebook.uri)} is already running.`,
        MessageKind.WARNING,
        { logger },
      );
      return;
    }

    const selection = {
      text,
      context: contextAbove(
        editor.document.getText(
          new vscode.Range(0, 0, editor.selection.start.line, 0),
        ),
      ),
    };
    this.selections.set(cell, selection);
    try {
      await vscode.commands.executeCommand("notebook.cell.execute", {
        ranges: [{ start: cell.index, end: cell.index + 1 }],
        document: cell.notebook.uri,
      });
    } finally {
      if (this.selections.get(cell) === selection) {
        this.selections.delete(cell);
      }
    }
  }

  private takeSelection(cells: vscode.NotebookCell[]) {
    if (cells.length !== 1) return undefined;
    const selection = this.selections.get(cells[0]);
    this.selections.delete(cells[0]);
    return selection;
  }

  async executeRepl(
    cells: vscode.NotebookCell[],
    notebook: vscode.NotebookDocument,
    controller: vscode.NotebookController,
    label?: string,
    selection?: string,
  ) {
    let repl: ReplConnection;
    try {
      repl = label
        ? await ReplConnection.forLabel(label)
        : await ReplConnection.getOrCreateInstance(notebook.uri);
    } catch (error) {
      reportReplError(error);
      return;
    }

    for (const cell of cells) {
      const execution = controller.createNotebookCellExecution(cell);

      execution.executionOrder = ++this.order;
      execution.start(Date.now());
      execution.clearOutput();

      let success = false;
      const cancellation = execution.token.onCancellationRequested(() =>
        repl.cancel(),
      );

      try {
        const kind = getCellKind(cell);
        const text = selection ?? cell.document.getText();
        if (!text.trim()) {
          // Nothing to run. Checked before wrapping, because the SQL and
          // Python wrappers turn an empty cell into a statement the REPL
          // would send.
          this.writeOutput(execution, { text: "", mime: "text/plain" });
          success = true;
          continue;
        }
        const result = await repl.executeQuery(
          kind === CellKind.PYTHON
            ? getPythonWrapper(text, "serialized")
            : kind === CellKind.SQL
              ? getSQLWrapper(text)
              : text,
          undefined,
          kind === CellKind.PYTHON ? text : undefined,
        );
        this.writeOutput(execution, {
          text: result.output || "",
          mime: "text/plain",
        });
        if (result.cancelled) break;
        else success = true;
      } catch (error) {
        this.writeOutput(execution, { text: `${error}`, mime: "text/plain" });
        break;
      } finally {
        cancellation.dispose();
        execution.end(success, Date.now());
        this.running.delete(cell);
      }
    }
  }

  async execute(
    cells: vscode.NotebookCell[],
    notebook: vscode.NotebookDocument,
    controller: vscode.NotebookController,
  ): Promise<void> {
    const selection = this.takeSelection(cells);
    cells.forEach((cell) => this.running.add(cell));
    try {
      await this.executeCells(
        cells,
        notebook,
        controller,
        selection?.text,
        selection?.context,
      );
    } finally {
      cells.forEach((cell) => this.running.delete(cell));
    }
  }

  private async executeCells(
    cells: vscode.NotebookCell[],
    notebook: vscode.NotebookDocument,
    controller: vscode.NotebookController,
    selection?: string,
    context?: string,
  ) {
    // Same precedence as a q/Python/SQL file: an explicit assignment first,
    // then the active target, then the REPL.
    const runTarget = await resolveRunTarget(notebook.uri);
    if (!runTarget) {
      return;
    }
    if (runTarget.kind === "repl") {
      return this.executeRepl(
        cells,
        notebook,
        controller,
        runTarget.label,
        selection,
      );
    }

    const conn = runTarget.conn;

    for (const cell of cells) {
      const execution = controller.createNotebookCellExecution(cell);

      execution.executionOrder = ++this.order;
      execution.start(Date.now());

      const requestID = crypto.randomUUID();
      const cellTarget = registerImageTarget(requestID, execution, cell);
      cellTarget.applied = execution.clearOutput();

      let success = false;
      let cancellationDisposable: vscode.Disposable | undefined;

      try {
        const kind = getCellKind(cell);
        const text = selection ?? cell.document.getText();

        if (!text.trim()) {
          this.writeOutput(
            execution,
            { text: "", mime: "text/plain" },
            cellTarget,
          );
          success = true;
          continue;
        }

        this.checkCellMetadata(cell, conn);

        const executor = this.getQueryExecutor(
          conn,
          execution,
          cell,
          kind,
          text,
          requestID,
          context,
        );

        const results = await Promise.race([
          executor,
          new Promise((_, reject) => {
            const updateCancelled = () => {
              if (execution.token.isCancellationRequested) {
                reject(new vscode.CancellationError());
              }
            };
            updateCancelled();
            cancellationDisposable =
              execution.token.onCancellationRequested(updateCancelled);
          }),
        ]);

        notifyExecution(
          RunFlag.Notebook |
            RunFlag.Run |
            (isQuickAlias(conn.connLabel) ? RunFlag.Quick : 0) |
            (kind === CellKind.PYTHON ? RunFlag.Python : 0) |
            (kind === CellKind.SQL ? RunFlag.Sql : 0),
        );

        const rendered = render(results, kind === CellKind.PYTHON);

        this.writeOutput(execution, rendered, cellTarget);
        success = true;
      } catch (error) {
        notify(`Execution on ${conn.connLabel} stopped.`, MessageKind.DEBUG, {
          logger,
          params: error,
        });
        this.writeOutput(
          execution,
          {
            text: `<p>Execution stopped.</p><p>${escapeHtml(`${error instanceof Error ? error.message : error}`)}</p>`,
            mime: "text/html",
          },
          cellTarget,
        );
        break;
      } finally {
        cellTarget.endedAt = Date.now();
        cancellationDisposable?.dispose();
        execution.end(success, Date.now());
        this.running.delete(cell);
      }
    }
  }

  checkCellMetadata(cell: vscode.NotebookCell, conn: LocalConnection) {
    const target = cell.metadata?.target;
    const variable = cell.metadata?.variable;
    if (target) {
      throw new Error(
        `Setting execution target (${target}) is not supported on ${conn.connLabel}.`,
      );
    }
    if (variable) {
      throw new Error(
        `Setting output variable ${variable} is not supported on ${conn.connLabel}.`,
      );
    }
  }

  getQueryExecutor(
    conn: LocalConnection,
    execution: vscode.NotebookCellExecution,
    cell: vscode.NotebookCell,
    kind: CellKind,
    text: string,
    requestID?: string,
    context = ".",
  ): Promise<any> {
    const executorName = getBasename(cell.notebook.uri);
    return executeQuery(
      kind === CellKind.SQL ? getSQLWrapper(text) : text,
      conn.connLabel,
      executorName,
      kind === CellKind.Q ? context : ".",
      kind === CellKind.PYTHON,
      false,
      false,
      execution.token,
      undefined,
      requestID,
    );
  }

  writeOutput(
    execution: vscode.NotebookCellExecution,
    rendered: Rendered,
    target?: ext.CellExecutionTarget,
  ): void {
    const output = new vscode.NotebookCellOutput([
      vscode.NotebookCellOutputItem.text(rendered.text, rendered.mime),
    ]);

    const applied = execution.appendOutput(output);

    if (target) {
      target.outputs.push(output);
      target.applied = applied;
    }
  }
}

interface Rendered {
  text: string;
  mime: string;
}

function renderTable(table: any): string {
  const defs: any[] = table.columnDefs;
  const fields: string[] = defs.map((def) =>
    "field" in def ? def.field || "" : "",
  );

  const rows: string[] = ["<table>", "<thead>", "<tr>"];

  for (const def of defs) {
    rows.push(`<th>${escapeHtml(`${def.headerName}`)}</th>`);
  }
  rows.push("</tr>", "</thead>", "<tbody>");

  for (const row of table.rowData || []) {
    rows.push("<tr>");
    for (const field of fields) {
      rows.push(`<td>${field ? escapeHtml(`${row[field]}`) : "n/a"}</td>`);
    }
    rows.push("</tr>");
  }
  rows.push("</tbody>", "</table>");

  return rows.join("\n");
}

function render(results: any, isPython: boolean): Rendered {
  const plot = resultToBase64(results);
  if (plot) {
    return { text: `<img src="${plot}"/>`, mime: "text/html" };
  }

  if (typeof results === "string" || typeof results === "number") {
    return { text: formatResult(results), mime: "text/html" };
  }

  if (results) {
    const table = convertToGrid(results, false, undefined, isPython);
    if (table.columnDefs) {
      return { text: renderTable(table), mime: "text/html" };
    }
  }

  return { text: "No results.", mime: "text/plain" };
}
