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
import * as fs from "node:fs";
import * as path from "node:path";
import * as vscode from "vscode";

import { activate, file, focus, WORKSPACE } from "./utils";
import { ensure, labelOf } from "./utils/connection";
import { webview } from "./utils/webview";
import { queryWrapper } from "../../src/utils/queryUtils";
import { convertToGrid } from "../../src/utils/resultsRenderer";

// Smoke against a real peachq process started outside the window; skipped
// unless PEACHQ_PORT names it.
const PORT = process.env.PEACHQ_PORT;

const SERVER = {
  serverName: "127.0.0.1",
  serverPort: PORT ?? "0",
  serverAlias: "PEACHQ",
  auth: false,
  tls: false,
  managed: false,
};
const CONNECTION = labelOf(SERVER);
const QUERY_FILE = file("peachq.q");
const PLOT_FILE = file("peachq-plot.q");
const PNG = path.join(WORKSPACE, "peachq.png");
const TABLE = "([]sym:`a`b`c;px:1.5 2.5 3.5;n:1 2 3)";

function side(): Promise<nodeq.Connection> {
  return new Promise((resolve, reject) =>
    nodeq.connect({ host: "127.0.0.1", port: Number(PORT) }, (err, conn) =>
      err ? reject(err) : resolve(conn),
    ),
  );
}

function k(conn: nodeq.Connection, expr: string, arg?: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const done = (err: Error, res: any) => (err ? reject(err) : resolve(res));
    if (arg === undefined) conn.k(expr, done);
    else conn.k(expr, arg, done);
  });
}

(PORT ? describe : describe.skip)("Smoke against a real peachq", function () {
  let probe: nodeq.Connection;
  let mapped: { [key: string]: string } | undefined;

  // The log records every sync request the extension sends, so the test can
  // see the handshake and the wrapper arrive rather than trusting a stub.
  const sent = async () =>
    (await k(probe, "{.smoke.log}", null)) as (string | unknown[])[];

  before(async () => {
    await activate();
    probe = await side();
    await k(
      probe,
      ".smoke.log:();.z.pg:{.smoke.log,:enlist $[10h=type x;x;first x];value x}",
    );

    fs.writeFileSync(
      QUERY_FILE.fsPath,
      `t:${TABLE}\nselect from t where n>1\n`,
    );
    fs.writeFileSync(PNG, fs.readFileSync(process.env.PEACHQ_PNG ?? ""));
    fs.writeFileSync(PLOT_FILE.fsPath, `read1 hsym \`$"${PNG}"\n`);

    const config = vscode.workspace.getConfiguration("peachq");
    mapped = config.get("connectionMap");
    await config.update(
      "connectionMap",
      { ...mapped, "peachq.q": "PEACHQ", "peachq-plot.q": "PEACHQ" },
      vscode.ConfigurationTarget.Workspace,
    );

    await ensure(SERVER);
    for (let i = 0; i < 20 && (await k(probe, "count .z.W")) < 2; i++) {
      await vscode.commands.executeCommand(
        "peachq.connections.connect.via.dialog",
        CONNECTION,
      );
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  });

  after(async () => {
    await vscode.commands.executeCommand("peachq.results.destination.terminal");
    await vscode.commands.executeCommand(
      "peachq.connections.disconnect",
      CONNECTION,
    );
    await vscode.workspace
      .getConfiguration("peachq")
      .update("connectionMap", mapped, vscode.ConfigurationTarget.Workspace);
    for (const target of [QUERY_FILE.fsPath, PLOT_FILE.fsPath, PNG]) {
      fs.rmSync(target, { force: true });
    }
    probe?.close();
    await vscode.commands.executeCommand("workbench.action.closeAllEditors");
  });

  it("connects and probes for the .vscode namespace", async () => {
    assert.ok(
      (await k(probe, "count .z.W")) >= 2,
      "the extension never connected",
    );
    const log = await sent();
    assert.ok(
      log.some((entry) => entry === ".vscode.getManifest"),
      `no handshake in ${JSON.stringify(log).slice(0, 300)}`,
    );
  });

  it("runs a file through the evaluate wrapper and peachq evaluates it", async () => {
    const before = (await sent()).length;
    await focus(QUERY_FILE);
    await vscode.commands.executeCommand("peachq.results.destination.view");
    await vscode.commands.executeCommand("peachq.execute.fileQuery");
    for (let i = 0; i < 40 && (await sent()).length === before; i++) {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    const wrapper = (await sent())
      .slice(before)
      .find((entry) => String(entry).includes("evaluateQ"));
    assert.ok(wrapper, "the evaluate wrapper never arrived");
    assert.deepStrictEqual(await k(probe, "exec n from t"), [1, 2, 3]);
  });

  it("renders what peachq answers in the results grid", async () => {
    const context = {
      asAbsolutePath: (rel: string) =>
        path.join(WORKSPACE, "..", "..", "..", rel),
    } as vscode.ExtensionContext;
    const reply = await k(
      probe,
      queryWrapper(false, false, undefined, context),
      {
        ctx: ".",
        code: `select from ${TABLE} where n>1`,
        returnFormat: "structuredText",
        sampleFn: null,
        sampleSize: null,
      },
    );
    assert.strictEqual(reply.error, false, reply.errorMsg);
    const grid = convertToGrid(JSON.parse(reply.data), false);

    const view = await webview("kdb-results-view");
    try {
      await view.send({
        command: "setGridDatasource",
        results: grid.rowData,
        columnDefs: grid.columnDefs,
        theme: "legacy",
        themeColor: "ag-theme-alpine-dark",
      });
      const shown = await view.eval(async () => {
        await __until(
          () => __find("kdb-results-view >>> table"),
          "the table to render",
        );
        const table = __find("kdb-results-view >>> table");
        return {
          headers: [...table.querySelectorAll("th")].map((h: any) =>
            h.textContent.replace(/\s+/g, " ").trim(),
          ),
          rows: [...table.querySelectorAll("tbody tr")].map((r: any) =>
            [...r.querySelectorAll("td")].map((c: any) => c.textContent.trim()),
          ),
        };
      });
      console.log("peachq grid:", JSON.stringify(shown));
      assert.deepStrictEqual(
        shown.rows.map((row: string[]) => row.slice(-3)),
        [
          ["`b", "2.5", "2"],
          ["`c", "3.5", "3"],
        ],
      );
    } finally {
      view.dispose();
    }
  });

  it("opens a PNG that peachq returns in the chart viewer", async () => {
    await focus(PLOT_FILE);
    await vscode.commands.executeCommand("peachq.results.destination.view");
    await vscode.commands.executeCommand("peachq.execute.fileQuery");
    const chart = () =>
      vscode.window.tabGroups.all
        .flatMap((group) => group.tabs)
        .find(
          (tab) =>
            tab.input instanceof vscode.TabInputCustom &&
            tab.input.viewType === "peachq.chartEditor",
        );
    for (let i = 0; i < 40 && !chart(); i++) {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    const tab = chart();
    assert.ok(tab, "no chart viewer opened");
    const uri = (tab.input as vscode.TabInputCustom).uri;
    const plot = JSON.parse(
      (await vscode.workspace.openTextDocument(uri)).getText(),
    );
    console.log("peachq plot:", uri.fsPath, plot.charts[0].data.slice(0, 40));
    assert.ok(plot.charts[0].data.startsWith("data:image/png;base64,"));
  });
});
