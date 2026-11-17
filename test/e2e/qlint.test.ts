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

import * as assert from "node:assert";
import { execFileSync, spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import * as vscode from "vscode";

import { WORKSPACE, activate } from "./utils";

const ROOT = path.join(WORKSPACE, "..", "..", "..");
const FOLDER = path.join(WORKSPACE, "qlint");
const BUNDLED = path.join(
  ROOT,
  "bin",
  "peachq",
  `${process.platform}-${process.arch}`,
  "q",
);
const BINARY = process.env.PEACHQ_LSP_Q || BUNDLED;
const INIT = JSON.stringify({
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: { capabilities: {} },
});

function speaksLsp() {
  if (!fs.existsSync(BINARY)) {
    return false;
  }
  const reply = spawnSync(BINARY, ["-lsp"], {
    input: `Content-Length: ${INIT.length}\r\n\r\n${INIT}`,
    timeout: 3000,
  });
  return `${reply.stdout}`.includes('"name":"qlint"');
}

const write = (name: string, text: string) => {
  const target = path.join(FOLDER, name);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, text);
  return vscode.Uri.file(target);
};

const diagnostics = (uri: vscode.Uri) => vscode.languages.getDiagnostics(uri);

function next(
  uri: vscode.Uri,
  done: (found: vscode.Diagnostic[]) => boolean,
  ms = 10_000,
): Promise<vscode.Diagnostic[]> {
  return new Promise((resolve, reject) => {
    const check = () => {
      const found = diagnostics(uri);
      if (done(found)) {
        listener.dispose();
        clearTimeout(timer);
        resolve(found);
      }
    };
    const listener = vscode.languages.onDidChangeDiagnostics(check);
    const timer = setTimeout(() => {
      listener.dispose();
      reject(
        new Error(
          `diagnostics for ${uri}: ${JSON.stringify(diagnostics(uri))}`,
        ),
      );
    }, ms);
    check();
  });
}

const codes = (found: vscode.Diagnostic[]) =>
  found.map((item) => `${item.source}:${item.code}`);

async function replace(document: vscode.TextDocument, text: string) {
  const edit = new vscode.WorkspaceEdit();
  edit.replace(
    document.uri,
    new vscode.Range(0, 0, document.lineCount, 0),
    text,
  );
  await vscode.workspace.applyEdit(edit);
}

async function open(uri: vscode.Uri) {
  const document = await vscode.workspace.openTextDocument(uri);
  await vscode.window.showTextDocument(document, { preview: false });
  return document;
}

function serverPid() {
  const listing = execFileSync("ps", ["-eo", "pid=,args="], {
    encoding: "utf8",
  });
  return listing
    .split("\n")
    .map((line) => line.trim().split(/\s+/))
    .find((args) => args[1] === BINARY && args[2] === "-lsp")?.[0];
}

describe("qlint diagnostics from q -lsp", function () {
  before(async function () {
    if (!speaksLsp()) {
      this.skip();
    }
    fs.rmSync(FOLDER, { recursive: true, force: true });
    await vscode.workspace
      .getConfiguration("peachq")
      .update("linting", true, vscode.ConfigurationTarget.Workspace);
    await activate();
  });

  after(async () => {
    await vscode.commands.executeCommand("workbench.action.closeAllEditors");
    fs.rmSync(FOLDER, { recursive: true, force: true });
    await vscode.workspace
      .getConfiguration("peachq")
      .update("linting", undefined, vscode.ConfigurationTarget.Workspace);
    await vscode.workspace
      .getConfiguration("peachq.lint")
      .update("enabled", undefined, vscode.ConfigurationTarget.Workspace);
  });

  it("reports a literal type error once, from qlint alone, and clears it when fixed", async () => {
    const uri = write("literal.q", 'a:6+"hi"\nb:"\\q"\n');
    const document = await open(uri);

    const found = await next(uri, (all) => all.length > 0);
    await new Promise((resolve) => setTimeout(resolve, 1000));

    assert.deepStrictEqual(codes(diagnostics(uri)), ["qlint:LITERAL_ERROR"]);
    assert.strictEqual(found[0].severity, vscode.DiagnosticSeverity.Error);
    assert.deepStrictEqual(
      [found[0].range.start.character, found[0].range.end.character],
      [2, 8],
    );

    await replace(document, 'a:6+1\nb:"\\q"\n');
    await next(uri, (all) => all.length === 0);
  });

  it("honours an @qlintsuppress comment", async () => {
    const uri = write(
      "suppressed.q",
      '/ @qlintsuppress LITERAL_ERROR\na:6+"hi"\nf:{b:1; 2}\n',
    );
    await open(uri);

    const found = await next(uri, (all) => all.length > 0);

    assert.deepStrictEqual(codes(found), ["qlint:UNUSED_VAR"]);
  });

  it("reads lint.config from the document's folder", async () => {
    write(path.join("off", "lint.config"), "UNUSED_VAR : false\n");
    const off = write(path.join("off", "unused.q"), 'f:{b:1; 2}\na:6+"hi"\n');
    const on = write(path.join("on", "unused.q"), 'f:{b:1; 2}\na:6+"hi"\n');
    await open(off);
    await open(on);

    const quiet = await next(off, (all) => all.length > 0);
    const loud = await next(on, (all) => all.length > 1);

    assert.deepStrictEqual(codes(quiet), ["qlint:LITERAL_ERROR"]);
    assert.deepStrictEqual(codes(loud).sort(), [
      "qlint:LITERAL_ERROR",
      "qlint:UNUSED_VAR",
    ]);
  });

  it("lints an untitled document with the default rules", async () => {
    const document = await vscode.workspace.openTextDocument({
      language: "q",
      content: 'f:{b:1; 2}\na:6+"hi"\n',
    });
    await vscode.window.showTextDocument(document);

    const found = await next(document.uri, (all) => all.length > 1);

    assert.deepStrictEqual(codes(found).sort(), [
      "qlint:LITERAL_ERROR",
      "qlint:UNUSED_VAR",
    ]);
  });

  it("places a squiggle after non-ASCII text in UTF-16 columns", async () => {
    const uri = write("unicode.q", 's:"héllo €"; 6+"hi"\nt:"😀"; 7+"no"\n');
    await open(uri);

    const found = await next(uri, (all) => all.length > 1);
    const document = await vscode.workspace.openTextDocument(uri);

    assert.deepStrictEqual(
      found.map((item) => document.getText(item.range)),
      ['6+"hi"', '7+"no"'],
    );
  });

  it("measures change to diagnostics", async () => {
    const sources = [
      path.join(ROOT, "resources", "q", "listMem.q"),
      path.join(ROOT, "test", "q", "qunit", "formatQTest.q"),
      ...(process.env.QLINT_LARGE ?? "").split(path.delimiter).filter(Boolean),
    ];
    for (const source of sources) {
      const text = fs.readFileSync(source, "utf8");
      const uri = write(`timing/${path.basename(source)}`, text);
      const document = await open(uri);
      await next(uri, () => true);
      const times: number[] = [];
      for (let round = 0; round < 5; round++) {
        await replace(document, text + `\nzz:6+"x${round}"\n`);
        const start = Date.now();
        await next(uri, (all) =>
          all.some((item) => item.range.start.line >= document.lineCount - 3),
        );
        times.push(Date.now() - start);
        await replace(document, text);
        await next(uri, (all) =>
          all.every((item) => item.range.start.line < document.lineCount - 3),
        );
      }
      console.log(
        `qlint latency ${path.basename(source)} ${text.length} bytes: ${times.join(" ")} ms`,
      );
    }
  });

  it("comes back after its process is killed", async () => {
    const uri = write("restart.q", "a:1\n");
    const document = await open(uri);
    const pid = serverPid();
    assert.ok(pid, "no q -lsp process found");

    process.kill(Number(pid), "SIGKILL");
    for (let attempt = 0; attempt < 100 && serverPid() === pid; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    await replace(document, 'a:6+"hi"\n');

    await next(uri, (all) => all.length === 1, 20_000);
    assert.notStrictEqual(serverPid(), pid);
  });

  it("stops and starts with peachq.lint.enabled", async () => {
    const uri = write("toggle.q", 'a:6+"hi"\n');
    await open(uri);
    await next(uri, (all) => all.length === 1);
    const settings = () => vscode.workspace.getConfiguration("peachq.lint");

    await settings().update(
      "enabled",
      false,
      vscode.ConfigurationTarget.Workspace,
    );
    await next(uri, (all) => all.length === 0);
    for (let attempt = 0; attempt < 100 && serverPid(); attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    assert.strictEqual(serverPid(), undefined);

    await settings().update(
      "enabled",
      undefined,
      vscode.ConfigurationTarget.Workspace,
    );
    await next(uri, (all) => all.length === 1);
  });
});
