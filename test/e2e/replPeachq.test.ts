/*
 * Copyright (c) 2026 peachq contributors
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

import * as assert from "node:assert";
import * as vscode from "vscode";

import {
  activate,
  discardNotebook,
  executeNotebook,
  outputs,
  qNotebook,
  startNotebook,
  terminal,
  terminalText,
  until,
} from "./utils";

// Run by `npm run test:e2e:peachq`, in a window test/runE2E.ts opens on a
// workspace whose only q is the peachq PEACHQ_Q names. Each row is the REPL
// contract as qdocs documents kdb; a row peachq breaks is skipped with the
// NOTES-FOR-PEACHQ.md line that records it.
const REPL = "peachq REPL";

let count = 0;

// A notebook routes to the REPL when nothing else is connected, and each cell
// output is exactly what that execution printed.
function notebook(...sources: string[]) {
  const folder = vscode.workspace.workspaceFolders![0].uri;
  return qNotebook(vscode.Uri.joinPath(folder, `row${++count}.kxnb`), sources);
}

const lf = (text: string) => text.replace(/\r\n/g, "\n");

async function results(...sources: string[]) {
  const opened = await notebook(...sources);
  const shown = await executeNotebook(opened);
  await until(
    () =>
      opened
        .getCells()
        .every((cell) => cell.executionSummary?.success !== undefined),
    `every cell to resolve: ${sources.join(" | ")}`,
  );
  const cells = opened.getCells().map((cell, index) => ({
    output: lf(shown[index]),
    success: cell.executionSummary?.success,
  }));
  await discardNotebook(opened);
  return cells;
}

describe("The REPL on peachq", function () {
  before(async function () {
    if (!process.env.PEACHQ_Q) {
      this.skip();
    }
    await activate();
  });

  after(async () => {
    await vscode.commands.executeCommand("workbench.action.closeAllEditors");
  });

  it("answers 1+1 with exactly 2 and resolves", async () => {
    const [cell] = await results("1+1");
    assert.deepStrictEqual(cell, { output: "2\n", success: true });
  });

  it("reports an error and still resolves the next query", async () => {
    const [failed, next, namespace] = await results("1+`a", "2+2", 'system"d"');
    assert.ok(failed.output.startsWith("'type\n"), failed.output);
    assert.ok(!failed.output.includes(".z.pi"), failed.output);
    assert.strictEqual(next.output, "4\n");
    assert.strictEqual(namespace.output, "`.\n");
  });

  it("does not suspend on an error inside a lambda", async () => {
    const [failed, next] = await results("{x+y}[1;`a]", "3+3");
    assert.ok(failed.output.startsWith("'type\n"), failed.output);
    assert.strictEqual(next.output, "6\n");
  });

  // NOTES-FOR-PEACHQ.md: .Q.trp puts the input line below the handler.
  it.skip("shows the failing line in the backtrace", async () => {
    const [failed] = await results("1+`a");
    assert.match(failed.output, /^ {2}\[\d+\] {2}1\+`a$/m);
  });

  it("switches namespace with \\d", async () => {
    const [, inside, , outside] = await results(
      "\\d .foo",
      'system"d"',
      "\\d .",
      'system"d"',
    );
    assert.strictEqual(inside.output, "`.foo\n");
    assert.strictEqual(outside.output, "`.\n");
  });

  it("runs each line of a multi-line cell in turn", async () => {
    const [cell] = await results("1+1\n{x+\n  y}[1;2]\n2+2");
    assert.deepStrictEqual(cell, { output: "2\n3\n4\n", success: true });
  });

  it("prints what show prints and not the handler's own result", async () => {
    const [cell] = await results('"s"');
    assert.strictEqual(cell.output, '"s"\n');
  });

  // NOTES-FOR-PEACHQ.md: a lone `\` does not switch to k.
  it.skip("switches to k and back with a lone backslash", async () => {
    const repl = terminal(REPL);
    assert.ok(repl, "no REPL terminal is open");
    for (const line of ["\\", "!5", "\\"]) {
      repl.sendText(line, false);
      repl.sendText("\r", false);
    }
    await until(
      async () => (await terminalText(REPL)).includes("0 1 2 3 4"),
      "k to answer !5",
    );
  });

  // qdocs learn/licensing.md: kdb ends with a timestamped error.
  it("ends the execution on a fatal timestamped error", async () => {
    const opened = await notebook(
      "-2 \"'2018.03.28T11:20:03.831 couldn't connect to license daemon -- exiting\";exit 1",
      '"NOT RUN"',
    );
    await startNotebook(opened);
    const [fatal, after] = opened.getCells();
    await until(
      () => fatal.executionSummary?.success === false,
      "the fatal error to end the execution",
    );
    assert.match(outputs(opened)[0], /^'2018\.03\.28T11:20:03\.831 couldn't/);
    await until(
      async () => (await terminalText(REPL)).includes("exited with code (1)"),
      "the REPL to report the exit",
    );
    assert.strictEqual(after.outputs.length, 0);
    await discardNotebook(opened);
  });
});
