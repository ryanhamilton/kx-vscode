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
import * as fs from "node:fs";
import * as vscode from "vscode";

import { file, focus, until, waitForLanguageServer } from "./utils";
import { dial } from "./utils/connection";
import * as prompt from "./utils/prompt";
import { FakeQ } from "./utils/qserver";

// Runs twice: in the usual window, and under `npm run test:e2e:kx`, which also
// loads the code-free stand-in in test/e2e/fakekx as the KX extension.
const KX = !!vscode.extensions.getExtension("KX.kdb");
const PAUSED = "The KX extension is active";
const LANG = file("lang.q");

describe(KX ? "Beside the KX extension" : "Without the KX extension", () => {
  let api: { deferringToKx: boolean };
  let wasActive = false;

  before(async () => {
    const extension = vscode.extensions.getExtension("peachq.peachq");
    assert.ok(extension, "peachq is not installed in this window");
    wasActive = extension.isActive;
    if (KX) {
      prompt.clear();
      prompt.answer(PAUSED, "Keep KX");
    }
    api = await extension.activate();
  });

  it("registers every command it contributes", async () => {
    const registered = new Set(await vscode.commands.getCommands(true));
    const { commands } = vscode.extensions.getExtension("peachq.peachq")!
      .packageJSON.contributes as { commands: { command: string }[] };
    assert.deepStrictEqual(
      commands.map((c) => c.command).filter((id) => !registered.has(id)),
      [],
    );
  });

  if (!KX) {
    it("runs its language server and does not defer", async () => {
      assert.strictEqual(api.deferringToKx, false);
      await waitForLanguageServer(LANG);
    });
    return;
  }

  it("defers and leaves its language server off", async () => {
    assert.strictEqual(api.deferringToKx, true);
    await vscode.workspace.openTextDocument(LANG);
    await new Promise((resolve) => setTimeout(resolve, 2000));
    const symbols = await vscode.commands.executeCommand<
      vscode.DocumentSymbol[]
    >("vscode.executeDocumentSymbolProvider", LANG);
    assert.ok(!symbols?.length, "a language server answered");
  });

  it("asks once which extension to use", async () => {
    assert.ok(!wasActive, "peachq activated before the prompt could be seen");
    await prompt.untilRaised(PAUSED);
    assert.deepStrictEqual(
      prompt.raised(PAUSED).map((n) => n.buttons),
      [["Use peachq here", "Keep KX"]],
    );
  });

  describe("importing from it", () => {
    const kx = new FakeQ();
    const other = new FakeQ();
    const server = (serverAlias: string, serverPort: string) => ({
      serverName: "127.0.0.1",
      serverPort,
      serverAlias,
      auth: false,
      tls: false,
    });
    const KX_SERVER = server("TESTKX", "25120");
    const OTHER_SERVER = server("TESTKXOTHER", "25121");
    const MAPPED = file("kxmapped.q");
    const user = vscode.ConfigurationTarget.Global;

    before(async () => {
      fs.writeFileSync(MAPPED.fsPath, '"KX_MAPPED"\n');
      await vscode.workspace
        .getConfiguration("kdb")
        .update(
          "servers",
          { TESTKX: KX_SERVER, TESTKXOTHER: OTHER_SERVER },
          user,
        );
      await vscode.workspace
        .getConfiguration("kdb")
        .update(
          "connectionMap",
          { "kxmapped.q": "TESTKX" },
          vscode.ConfigurationTarget.Workspace,
        );
      await kx.listen(Number(KX_SERVER.serverPort));
      await other.listen(Number(OTHER_SERVER.serverPort));
    });

    after(async () => {
      for (const label of ["TESTKX", "TESTKXOTHER"]) {
        await vscode.commands.executeCommand(
          "peachq.connections.disconnect",
          `${label} [127.0.0.1:${label === "TESTKX" ? 25120 : 25121}]`,
        );
      }
      await kx.close();
      await other.close();
      fs.rmSync(MAPPED.fsPath, { force: true });
      await vscode.workspace
        .getConfiguration("kdb")
        .update(
          "connectionMap",
          undefined,
          vscode.ConfigurationTarget.Workspace,
        );
      await vscode.workspace
        .getConfiguration("kdb")
        .update("servers", undefined, user);
      await vscode.workspace
        .getConfiguration("peachq")
        .update("servers", undefined, user);
    });

    it("copies the user's KX connections", async () => {
      await vscode.commands.executeCommand("peachq.importFromKx");
      assert.deepStrictEqual(
        vscode.workspace.getConfiguration("peachq").inspect("servers")
          ?.globalValue,
        { TESTKX: KX_SERVER, TESTKXOTHER: OTHER_SERVER },
      );
      await prompt.untilRaised("Imported servers");
    });

    it("runs a file the workspace kdb.connectionMap assigns", async () => {
      // Connecting by label needs the tree rebuilt with the imported entries.
      await vscode.commands.executeCommand("peachq-servers.focus");
      await dial("TESTKX [127.0.0.1:25120]", kx);
      // Connected last, so it is what an unassigned file would run on.
      await dial("TESTKXOTHER [127.0.0.1:25121]", other);
      await focus(MAPPED);
      kx.clear();
      other.clear();
      await vscode.commands.executeCommand("peachq.execute.fileQuery");
      const ran = (q: FakeQ) =>
        q.queries().some((r) => r.args?.code?.includes("KX_MAPPED"));
      await until(() => ran(kx) || ran(other), "the file to run");
      assert.ok(ran(kx) && !ran(other), "it ran on the wrong connection");
    });
  });
});
