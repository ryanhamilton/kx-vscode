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

import * as nodeq from "node-q";
import * as assert from "node:assert";
import { ChildProcess, execFileSync, spawn } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import * as vscode from "vscode";

import {
  activate,
  caretAt,
  focus,
  reachable,
  terminal,
  terminalText,
  until,
} from "./utils";
import { ensure, labelOf } from "./utils/connection";
import { answer, clear, raised } from "./utils/prompt";
import { qstudioWrap } from "../../src/q/reply";

// Run by `npm run test:e2e:peachq` against real peachq servers PEACHQ_Q starts,
// each logging every message its .z.pg is handed: text apart from calls, as
// peachq nests `log,:enlist x` wrongly once log holds a list (NOTES-FOR-PEACHQ).
const REPO = path.resolve(__dirname, "..", "..", "..");
const TABLE = "([]a:1 2 3;b:`x`y`z)";
const LOGGED =
  ".z.pg:{$[10h=type x; .e2e.text,:enlist x; .e2e.calls,:enlist first x]; value x}";

const server = (alias: string, port: number, queryMode?: string) => ({
  serverName: "127.0.0.1",
  serverPort: String(port),
  serverAlias: alias,
  auth: false,
  tls: false,
  managed: false,
  ...(queryMode ? { queryMode } : {}),
});

const PLAIN = server("PQPLAIN", 25110);
const NAKED = server("PQNAKED", 25110, "naked");
const API = server("PQAPI", 25111);
const FILE_NS = server("PQFILENS", 25110);
const AS_TYPED = server("PQASTYPED", 25110);
const ASKED = "This code is in namespace";

const processes: ChildProcess[] = [];

async function startPeachq(port: number, ...lines: string[]) {
  const folder = vscode.workspace.workspaceFolders![0].uri.fsPath;
  const script = path.join(folder, `server${port}.q`);
  fs.writeFileSync(
    script,
    [".e2e.text:.e2e.calls:()", ...lines, LOGGED, ""].join("\n"),
  );
  processes.push(
    spawn(
      process.env.PEACHQ_Q!,
      [script, "-p", `127.0.0.1:${port}`, "-q", "-classic"],
      { stdio: ["pipe", "ignore", "ignore"] },
    ),
  );
  await until(() => reachable("127.0.0.1", port), `peachq on ${port}`);
}

// Asked over a connection of its own, so the extension is not part of it.
function valueOn<T = string[]>(port: number, expression: string): Promise<T> {
  return new Promise((resolve, reject) =>
    nodeq.connect({ host: "127.0.0.1", port }, (error, conn) => {
      if (error || !conn) {
        return reject(error);
      }
      conn.k(expression, (failure: Error, value: T) => {
        conn.close();
        return failure ? reject(failure) : resolve(value);
      });
    }),
  );
}

const sentTexts = async (port: number, text: string) =>
  (await valueOn(port, ".e2e.text")).filter((message) =>
    message.includes(text),
  );

async function connect(each: typeof PLAIN) {
  const alias = each.serverAlias;
  const label = labelOf(each);
  for (
    let attempt = 0;
    attempt < 20 && !terminal(`peachq ${alias}`);
    attempt++
  ) {
    await vscode.commands.executeCommand(
      "peachq.connections.connect.via.dialog",
      label,
    );
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  await until(() => !!terminal(`peachq ${alias}`), `the ${alias} console`);
  return label;
}

async function queryFile(name: string, text: string, alias: string) {
  const folder = vscode.workspace.workspaceFolders![0].uri;
  const uri = vscode.Uri.joinPath(folder, name);
  fs.writeFileSync(uri.fsPath, text);
  const conf = vscode.workspace.getConfiguration("peachq", uri);
  await conf.update("connectionMap", {
    ...conf.get<Record<string, string>>("connectionMap", {}),
    [name]: alias,
  });
  return uri;
}

// The export writes what the grid holds into the workspace folder.
async function exportedGrid() {
  const folder = vscode.workspace.workspaceFolders![0].uri.fsPath;
  const csvs = () =>
    fs.readdirSync(folder).filter((name) => /^results-\d+\.csv$/.test(name));
  for (const name of csvs()) {
    fs.rmSync(path.join(folder, name));
  }
  await until(async () => {
    await vscode.commands.executeCommand("peachq.resultsPanel.export.csv");
    return csvs().length > 0;
  }, "the grid to be exported");
  const written = path.join(folder, csvs()[0]);
  const text = fs.readFileSync(written, "utf8");
  fs.rmSync(written);
  await vscode.commands.executeCommand("workbench.action.closeAllEditors");
  return text.split("\n");
}

async function run(uri: vscode.Uri, alias: string, line?: string) {
  const before = (await terminalText(`peachq ${alias}`)).length;
  if (line) {
    await caretAt(uri, line);
    await vscode.commands.executeCommand("peachq.execute.selectedQuery");
  } else {
    await focus(uri);
    await vscode.commands.executeCommand("peachq.execute.fileQuery");
  }
  let shown = "";
  await until(async () => {
    shown = (await terminalText(`peachq ${alias}`)).slice(before);
    return shown.trim().length > 0;
  }, `the ${alias} console to show the result`);
  return shown;
}

describe("Running a query on peachq", function () {
  const labels: string[] = [];

  before(async function () {
    if (!process.env.PEACHQ_Q) {
      this.skip();
    }
    await activate();
    execFileSync(process.execPath, [path.join(REPO, "build-api.js")], {
      cwd: REPO,
    });
    await startPeachq(25110);
    await startPeachq(25111, `\\l ${path.join(REPO, "out", "vscode.q")}`);
    for (const each of [PLAIN, NAKED, API, FILE_NS, AS_TYPED]) {
      await ensure(each);
      labels.push(await connect(each));
    }
    await vscode.commands.executeCommand("peachq-results.focus");
  });

  after(async () => {
    for (const label of labels) {
      await vscode.commands.executeCommand(
        "peachq.connections.disconnect",
        label,
      );
    }
    for (const child of processes) {
      child.kill();
    }
    await vscode.commands.executeCommand("workbench.action.closeAllEditors");
  });

  it("sends qStudio's wrapper once and shows the server's text and typed cells", async () => {
    const uri = await queryFile("table.q", TABLE, PLAIN.serverAlias);
    const shown = await run(uri, PLAIN.serverAlias);

    assert.deepStrictEqual(await sentTexts(25110, TABLE), [qstudioWrap(TABLE)]);
    assert.ok(/a b\s*\r?\n---\s*\r?\n1 x/.test(shown), shown);
    assert.strictEqual(
      vscode.window.activeTextEditor?.document.uri.toString(),
      uri.toString(),
      "the results view took focus",
    );
    const grid = await exportedGrid();
    assert.strictEqual(grid[0], "index,a,b");
    assert.strictEqual(grid[1], "0,1,x");
  });

  it("over the size cap shows the text only", async () => {
    const uri = await queryFile("big.q", "til 2000000", PLAIN.serverAlias);
    const shown = await run(uri, PLAIN.serverAlias);
    assert.ok(shown.includes("0 1 2 3"), shown);
  });

  it("sends exactly the text in naked mode", async () => {
    const text = "([]c:`p`q)";
    const uri = await queryFile("naked.q", text, NAKED.serverAlias);
    const shown = await run(uri, NAKED.serverAlias);

    assert.deepStrictEqual(await sentTexts(25110, "`p`q"), [text]);
    assert.ok(/c\s*\r?\n-\s*\r?\np/.test(shown), shown);
    assert.deepStrictEqual((await exportedGrid()).slice(0, 2), [
      "index,c",
      "0,p",
    ]);
  });

  it("still shows both through the .vscode API", async () => {
    const uri = await queryFile("api.q", TABLE, API.serverAlias);
    const shown = await run(uri, API.serverAlias);

    const calls = (await valueOn(25111, ".e2e.calls")).filter(
      (call) => call === ".vscode.runQQuery",
    );
    assert.strictEqual(calls.length, 1);
    assert.ok(/a\s+b\s*\r?\n-+\s*\r?\n1\s+`x/.test(shown), shown);
    assert.deepStrictEqual((await exportedGrid()).slice(0, 2), [
      "index,a,b",
      "0,1,`x",
    ]);
  });

  describe("from code under \\d .foo", () => {
    const namespaced = (name: string, line: string, alias: string) =>
      queryFile(name, `\\d .foo\n${line}\n`, alias);

    const stored = (alias: string) =>
      Object.values(
        vscode.workspace
          .getConfiguration()
          .get<
            Record<string, { serverAlias: string; namespacedRuns?: string }>
          >("peachq.servers") ?? {},
      ).find((each) => each.serverAlias === alias)?.namespacedRuns;

    it("never asks about a run from the root namespace", async () => {
      clear();
      const uri = await queryFile("root.q", "r:7", AS_TYPED.serverAlias);
      await run(uri, AS_TYPED.serverAlias);
      assert.strictEqual(await valueOn<number>(25110, "r"), 7);
      assert.deepStrictEqual(raised(ASKED), []);
    });

    it("asks once, and runs in the file's namespace when told to", async () => {
      clear();
      answer(ASKED, "Run in the file's namespace");
      const uri = await namespaced("file.q", "x:42", FILE_NS.serverAlias);
      await run(uri, FILE_NS.serverAlias, "x:42");

      assert.strictEqual(raised(ASKED).length, 1);
      assert.match(raised(ASKED)[0].message, /\.foo.*\\d \.foo.*PQFILENS/);
      assert.strictEqual(await valueOn<number>(25110, ".foo.x"), 42);
      const calls = await valueOn(25110, ".e2e.calls");
      assert.ok(
        calls.some((call) => call.startsWith("{[args]")),
        "not the evaluate lambda",
      );
      await until(
        () => stored(FILE_NS.serverAlias) === "file-namespace",
        "the answer to be stored with the connection",
      );

      clear();
      await run(uri, FILE_NS.serverAlias, "x:42");
      assert.deepStrictEqual(raised(ASKED), [], "asked again");
    });

    it("runs as typed in the root namespace when told to, and says so", async () => {
      clear();
      answer(ASKED, "Run as typed (root namespace)");
      const uri = await namespaced("typed.q", "t:44", AS_TYPED.serverAlias);
      const shown = await run(uri, AS_TYPED.serverAlias, "t:44");

      assert.strictEqual(raised(ASKED).length, 1);
      assert.deepStrictEqual(await sentTexts(25110, "t:44"), [
        qstudioWrap("t:44"),
      ]);
      assert.strictEqual(await valueOn<number>(25110, "t"), 44);
      assert.ok(shown.includes("root namespace, not .foo"), shown);
      await until(
        () => stored(AS_TYPED.serverAlias) === "as-typed",
        "the answer to be stored with the connection",
      );
    });
  });
});
