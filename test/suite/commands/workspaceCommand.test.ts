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

import * as assert from "assert";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import * as sinon from "sinon";
import * as vscode from "vscode";

import { setActiveTarget } from "../../../src/classes/activeTarget";
import {
  QNotFoundError,
  ReplConnection,
} from "../../../src/classes/replConnection";
import * as workspaceCommand from "../../../src/commands/workspaceCommand";
import { ext } from "../../../src/extensionVariables";
import { ExecutionTypes } from "../../../src/models/execution";
import { ConnectionManagementService } from "../../../src/services/connectionManagerService";
import { KdbNode } from "../../../src/services/kdbTreeProvider";
import { WorkspaceTreeProvider } from "../../../src/services/workspaceTreeProvider";
import * as coreUtils from "../../../src/utils/core";
import * as notifications from "../../../src/utils/notifications";
import * as widgets from "../../../src/utils/widgets";

describe("workspaceCommand", () => {
  const kdbUri = vscode.Uri.file("test-kdb.q");
  const remoteUri = vscode.Uri.file("tests.q");
  const pythonUri = vscode.Uri.file("test-python.q");
  const replUri = vscode.Uri.file("test-repl.q");
  const pinnedUri = vscode.Uri.file("test-pinned.q");
  const notebookUri = vscode.Uri.file("test.kxnb");

  const updateConfStub = sinon.stub();

  beforeEach(() => {
    const remoteNode = new KdbNode(
      [],
      "remote",
      {
        auth: false,
        serverAlias: "connection1",
        serverName: "",
        serverPort: "2",
        tls: false,
      },
      vscode.TreeItemCollapsibleState.None,
    );
    const kdbNode = new KdbNode(
      [],
      "local",
      {
        auth: false,
        serverAlias: "connection2",
        serverName: "",
        serverPort: "1",
        tls: false,
      },
      vscode.TreeItemCollapsibleState.None,
    );
    ext.serverProvider = <any>{
      async getChildren() {
        return [kdbNode, remoteNode];
      },
    };
    ext.connectionsList.push(kdbNode);
    ext.connectionsList.push(remoteNode);

    ext.activeTextEditor = <any>{
      document: {
        uri: remoteUri,
        fileName: "tests.q",
        getText() {
          return "";
        },
      },
    };

    sinon
      .stub(ConnectionManagementService.prototype, "isConnected")
      .returns(true);
    sinon.stub(vscode.workspace, "getWorkspaceFolder").value(
      () =>
        <vscode.WorkspaceFolder>{
          uri: vscode.Uri.file("/"),
          name: "test",
          index: 0,
        },
    );

    sinon.stub(vscode.workspace, "getConfiguration").value(() => {
      const relativePath = (uri: vscode.Uri) =>
        vscode.workspace.asRelativePath(uri, false);

      return {
        get(key: string) {
          switch (key) {
            case "servers":
              return [
                { serverAlias: "connection2" },
                { serverAlias: "connection1" },
              ];
            case "connectionMap":
              return {
                [relativePath(kdbUri)]: "connection2",
                [relativePath(pythonUri)]: "connection1",
                [relativePath(remoteUri)]: "connection1",
                [relativePath(replUri)]: ext.REPL,
                [relativePath(pinnedUri)]: "REPL (test/folderA)",
                [relativePath(notebookUri)]: "connection1",
              };
          }
          return {};
        },
        update: updateConfStub,
      };
    });
  });

  afterEach(() => {
    sinon.restore();
    updateConfStub.reset();
    ext.serverProvider = <any>{};
    ext.connectionsList.length = 0;
    ext.activeTextEditor = undefined;
  });

  describe("connectWorkspaceCommands", () => {
    it("should update views on delete and create", () => {
      let cb1, cb2, wbTree;
      sinon.stub(vscode.workspace, "createFileSystemWatcher").value(() => ({
        onDidCreate: (cb) => (cb1 = cb),
        onDidDelete: (cb) => (cb2 = cb),
      }));
      ext.scratchpadTreeProvider = <WorkspaceTreeProvider>{
        reload() {
          wbTree = true;
        },
      };
      workspaceCommand.connectWorkspaceCommands();
      cb1(vscode.Uri.file("test.q"));
      cb2(vscode.Uri.file("test.kdb.q"));
      assert.strictEqual(wbTree, true);
    });

    it("should reload the workbooks view when the workspace folders change", () => {
      let wbTree;
      sinon.stub(vscode.workspace, "createFileSystemWatcher").value(() => ({
        onDidCreate: () => undefined,
        onDidDelete: () => undefined,
      }));
      const folders = sinon.stub(
        vscode.workspace,
        "onDidChangeWorkspaceFolders",
      );
      ext.scratchpadTreeProvider = <WorkspaceTreeProvider>{
        reload() {
          wbTree = true;
        },
      };

      workspaceCommand.connectWorkspaceCommands();
      folders.firstCall.args[0](<any>undefined);

      assert.strictEqual(wbTree, true);
    });
  });

  describe("updateStatusBarItems", () => {
    const stubActiveTab = (input?: unknown) =>
      sinon.stub(vscode.window, "tabGroups").value({
        activeTabGroup: { activeTab: input ? { input } : undefined },
      });

    it("should show the connection of the active notebook", async () => {
      stubActiveTab(new vscode.TabInputNotebook(notebookUri, "kx-notebook"));
      const spy = sinon.spy(ext.runScratchpadItem, "show");
      await workspaceCommand.updateStatusBarItems();
      sinon.assert.called(spy);
      assert.strictEqual(ext.runScratchpadItem.text, "$(cloud) connection1");
    });

    it("should offer the active connection for an unassigned notebook", async () => {
      stubActiveTab(
        new vscode.TabInputNotebook(
          vscode.Uri.file("unassigned.kxnb"),
          "kx-notebook",
        ),
      );
      const spy = sinon.spy(ext.runScratchpadItem, "show");
      await workspaceCommand.updateStatusBarItems();
      sinon.assert.called(spy);
      assert.strictEqual(ext.runScratchpadItem.text, "$(cloud) (active)");
    });

    it("should hide the item without an active file", async () => {
      stubActiveTab();
      ext.activeTextEditor = undefined;
      const spy = sinon.spy(ext.runScratchpadItem, "hide");
      await workspaceCommand.updateStatusBarItems();
      sinon.assert.called(spy);
    });
  });

  describe("setServerForUri", () => {
    it("should associate a server with an uri", async () => {
      await assert.doesNotReject(() =>
        workspaceCommand.setServerForUri(
          vscode.Uri.file("test.kdb.q"),
          "connection1",
        ),
      );
    });
  });

  describe("files outside the workspace", () => {
    const outsideUri = vscode.Uri.file("/outside/test.q");
    let notifyStub: sinon.SinonStub;

    beforeEach(() => {
      sinon.stub(vscode.workspace, "getWorkspaceFolder").value(() => undefined);
      notifyStub = sinon.stub(notifications, "notify");
    });

    afterEach(async () => {
      await workspaceCommand.setServerForUri(outsideUri, undefined);
    });

    it("should associate a server in memory without notifying an error", async () => {
      await workspaceCommand.setServerForUri(outsideUri, "connection1");
      assert.strictEqual(
        workspaceCommand.getServerForUri(outsideUri),
        "connection1",
      );
      sinon.assert.notCalled(notifyStub);
      sinon.assert.notCalled(updateConfStub);
    });

    it("should associate a quick connection in memory", async () => {
      await workspaceCommand.setServerForUri(outsideUri, "localhost:5001");
      assert.strictEqual(
        workspaceCommand.getServerForUri(outsideUri),
        "localhost:5001",
      );
    });

    it("should clear the association", async () => {
      await workspaceCommand.setServerForUri(outsideUri, "connection1");
      await workspaceCommand.setServerForUri(outsideUri, undefined);
      assert.strictEqual(
        workspaceCommand.getServerForUri(outsideUri),
        undefined,
      );
    });

    it("should not leak the association to other uris", async () => {
      await workspaceCommand.setServerForUri(outsideUri, "connection1");
      assert.strictEqual(
        workspaceCommand.getServerForUri(vscode.Uri.file("/outside/other.q")),
        undefined,
      );
    });
  });

  describe("pickConnection", () => {
    it("should return undefined from (active)", async () => {
      sinon.stub(widgets, "showInputPicker").value(async () => "(active)");
      const result = await workspaceCommand.pickConnection(
        vscode.Uri.file("test.kdb.q"),
      );
      assert.strictEqual(result, undefined);
    });

    it("should return a REPL picked by name", async () => {
      sinon.stub(ReplConnection, "labels").returns(["test/folderA"]);
      let offered: readonly string[] = [];
      sinon
        .stub(widgets, "showInputPicker")
        .value(async (items: readonly string[]) => {
          offered = items;
          return "REPL (test/folderA)";
        });
      const result = await workspaceCommand.pickConnection(
        vscode.Uri.file("test.kdb.q"),
      );
      assert.deepStrictEqual(offered.slice(0, 2), [
        "(active)",
        "REPL (test/folderA)",
      ]);
      assert.strictEqual(result, "REPL (test/folderA)");
    });

    it("should offer the connections in the order the tree lists them", async () => {
      sinon.stub(ReplConnection, "labels").returns([]);
      sinon.stub(vscode.workspace, "getConfiguration").value(() => ({
        get: (key: string) =>
          key === "servers"
            ? [{ serverAlias: "local2" }, { serverAlias: "local1" }]
            : {},
      }));

      let offered: readonly string[] = [];
      sinon
        .stub(widgets, "showInputPicker")
        .value(async (items: readonly string[]) => {
          offered = items;
          return undefined;
        });

      await workspaceCommand.pickConnection(vscode.Uri.file("test.kdb.q"));

      assert.deepStrictEqual(offered.slice(0, 3), [
        "(active)",
        "local1",
        "local2",
      ]);
    });
  });

  describe("getActiveFileUri", () => {
    const notebookUri = vscode.Uri.file("notebook.kxnb");

    function activeTab(input?: unknown) {
      sinon.stub(vscode.window, "tabGroups").value({
        activeTabGroup: { activeTab: input ? { input } : undefined },
      });
    }

    it("should take the uri the notebook toolbar passes", () => {
      activeTab();
      const result = workspaceCommand.getActiveFileUri({
        notebookEditor: { notebookUri },
      });
      assert.strictEqual(result, notebookUri);
    });

    it("should take the notebook showing in front, no cell focused", () => {
      activeTab(new vscode.TabInputNotebook(notebookUri, "kx-notebook"));
      const result = workspaceCommand.getActiveFileUri();
      assert.strictEqual(result?.toString(), notebookUri.toString());
    });

    it("should take the active text editor otherwise", () => {
      activeTab(new vscode.TabInputText(remoteUri));
      const result = workspaceCommand.getActiveFileUri();
      assert.strictEqual(result, remoteUri);
    });

    it("should return undefined without an editor", () => {
      activeTab();
      ext.activeTextEditor = undefined;
      const result = workspaceCommand.getActiveFileUri();
      assert.strictEqual(result, undefined);
    });
  });

  describe("getConnectionForUri", () => {
    it("should return node", async () => {
      workspaceCommand.getConnectionForUri(remoteUri);
      workspaceCommand.getConnectionForUri(kdbUri);
    });

    it("should return undefined", async () => {
      ext.connectionsList.length = 0;
      const node = workspaceCommand.getConnectionForUri(remoteUri);
      assert.strictEqual(node, undefined);
    });
  });

  describe("ConnectionLensProvider", () => {
    describe("provideCodeLenses", () => {
      it("should return lenses", async () => {
        const document: vscode.TextDocument = <any>{
          uri: kdbUri,
        };
        const provider = new workspaceCommand.ConnectionLensProvider();
        const result = await provider.provideCodeLenses(document);
        assert.ok(result.length >= 1);
      });

      it("should return 2 lenses", async () => {
        const document: vscode.TextDocument = <any>{
          uri: remoteUri,
        };
        const provider = new workspaceCommand.ConnectionLensProvider();
        const result = await provider.provideCodeLenses(document);
        assert.ok(result.length >= 1);
      });
    });
  });

  describe("editor commands", () => {
    describe("runOnRepl", () => {
      let notifyStub, executeStub: sinon.SinonStub;
      const editor = <vscode.TextEditor>{
        document: <any>{
          uri: kdbUri,
          lineAt() {
            return "a:1;a";
          },
          getText() {
            return "a:1;a";
          },
        },
        selection: { active: { line: 0 } },
      };

      beforeEach(() => {
        notifyStub = sinon.stub(notifications, "notify");
      });

      // Only the tests that reach the REPL stub it, so the nested startRepl
      // describes are free to stub getOrCreateInstance themselves.
      function stubRepl() {
        executeStub = sinon.stub().resolves({});
        sinon
          .stub(ReplConnection, "getOrCreateInstance")
          .resolves(<ReplConnection>(
            (<unknown>{ show() {}, executeQuery: executeStub })
          ));
      }

      it("should execute q file", async () => {
        stubRepl();
        await workspaceCommand.runOnRepl(editor, ExecutionTypes.QueryFile);
        sinon.assert.calledOnce(executeStub);
      });

      it("should execute q selection", async () => {
        stubRepl();
        await workspaceCommand.runOnRepl(editor, ExecutionTypes.QuerySelection);
        sinon.assert.calledOnce(executeStub);
      });

      it("should notify execution error", async () => {
        stubRepl();
        executeStub.rejects(new Error("Test"));
        await workspaceCommand.runOnRepl(editor, ExecutionTypes.QueryFile);
        sinon.assert.calledOnce(notifyStub);
      });

      describe("startRepl", () => {
        const conn = <ReplConnection>{ start() {} };

        beforeEach(() => {
          sinon.stub(ReplConnection, "getOrCreateInstance").resolves(conn);
        });

        it("should start the workspace REPL", async () => {
          const startSpy = sinon.stub(conn, "start");
          await workspaceCommand.startRepl();
          sinon.assert.calledOnce(startSpy);
        });
      });

      describe("startReplInFolder", () => {
        const conn = <ReplConnection>{ start() {} };
        let openInFolder: sinon.SinonStub;
        let startSpy: sinon.SinonStub;
        let tmpDir: string;
        let tmpFile: string;

        before(() => {
          tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "kxrepl-"));
          tmpFile = path.join(tmpDir, "main.q");
          fs.writeFileSync(tmpFile, "");
        });

        after(() => {
          fs.rmSync(tmpDir, { recursive: true, force: true });
        });

        beforeEach(() => {
          startSpy = sinon.stub(conn, "start");
          openInFolder = sinon
            .stub(ReplConnection, "openInFolder")
            .resolves(conn);
        });

        it("should start a REPL based in the selected folder", async () => {
          const folder = vscode.Uri.file(tmpDir);
          await workspaceCommand.startReplInFolder(folder);
          assert.strictEqual(
            (openInFolder.firstCall.args[0] as vscode.Uri).fsPath,
            folder.fsPath,
          );
          sinon.assert.calledOnce(startSpy);
        });

        it("should base the REPL in a file's parent directory", async () => {
          await workspaceCommand.startReplInFolder(vscode.Uri.file(tmpFile));
          assert.strictEqual(
            (openInFolder.firstCall.args[0] as vscode.Uri).fsPath,
            vscode.Uri.file(tmpDir).fsPath,
          );
        });

        it("should fall back to the workspace REPL when no uri is given", async () => {
          const getOrCreate = sinon
            .stub(ReplConnection, "getOrCreateInstance")
            .resolves(conn);
          await workspaceCommand.startReplInFolder();
          sinon.assert.notCalled(openInFolder);
          sinon.assert.calledOnce(getOrCreate);
        });
      });
    });
  });

  describe("starting a REPL without q", () => {
    let notifyStub: sinon.SinonStub;

    beforeEach(() => {
      notifyStub = sinon.stub(notifications, "notify");
    });

    it("should leave it to the setup warning when no q was found", async () => {
      sinon
        .stub(ReplConnection, "getOrCreateInstance")
        .rejects(new QNotFoundError("no q was found"));
      await workspaceCommand.startRepl();
      sinon.assert.neverCalledWithMatch(
        notifyStub,
        sinon.match.any,
        notifications.MessageKind.ERROR,
      );
    });

    it("should report any other failure to start", async () => {
      sinon
        .stub(ReplConnection, "openInFolder")
        .rejects(new Error("spawn failed"));
      await workspaceCommand.startReplInFolder(vscode.Uri.file("/nowhere"));
      sinon.assert.calledWithMatch(
        notifyStub,
        "spawn failed",
        notifications.MessageKind.ERROR,
      );
    });
  });

  describe("pinned REPLs", () => {
    it("should keep a file pinned to a REPL assigned", () => {
      assert.strictEqual(
        workspaceCommand.getServerForUri(pinnedUri),
        "REPL (test/folderA)",
      );
    });

    it("should tell a REPL assignment from a connection", () => {
      assert.strictEqual(workspaceCommand.isRepl(ext.REPL), true);
      assert.strictEqual(workspaceCommand.isRepl("REPL (test)"), true);
      assert.strictEqual(workspaceCommand.isRepl("host:5001"), false);
      assert.strictEqual(workspaceCommand.isRepl("REPLICA"), false);
      assert.strictEqual(workspaceCommand.isRepl(undefined), false);
      assert.strictEqual(
        workspaceCommand.replLabelOf("REPL (test/a)"),
        "test/a",
      );
      assert.strictEqual(workspaceCommand.replLabelOf(ext.REPL), undefined);
    });

    it("should offer every open REPL", () => {
      sinon.stub(ReplConnection, "labels").returns(["test", "test/folderB"]);
      assert.deepStrictEqual(workspaceCommand.replChoices(), [
        "REPL (test)",
        "REPL (test/folderB)",
      ]);
    });

    it("should offer the REPL a file is pinned to when it is not open", () => {
      sinon.stub(ReplConnection, "labels").returns(["test"]);
      assert.deepStrictEqual(
        workspaceCommand.replChoices("REPL (test/folderA)"),
        ["REPL (test)", "REPL (test/folderA)"],
      );
    });

    it("should offer REPL to a file already assigned it", () => {
      sinon.stub(ReplConnection, "labels").returns(["test"]);
      assert.deepStrictEqual(workspaceCommand.replChoices(ext.REPL), [
        "REPL (test)",
        ext.REPL,
      ]);
    });

    it("should not offer REPL to a file not assigned it", () => {
      sinon.stub(ReplConnection, "labels").returns([]);
      assert.deepStrictEqual(workspaceCommand.replChoices(), []);
    });

    it("should name the REPL a file on the active REPL runs on", () => {
      sinon.stub(ReplConnection, "activeLabel").get(() => "test/folderB");
      assert.strictEqual(
        workspaceCommand.runItemText(ext.REPL),
        "REPL → test/folderB",
      );
      assert.strictEqual(
        workspaceCommand.runItemText("REPL (test/folderA)"),
        "REPL (test/folderA)",
      );
    });

    it("should say REPL when no REPL is active", () => {
      sinon.stub(ReplConnection, "activeLabel").get(() => undefined);
      assert.strictEqual(workspaceCommand.runItemText(ext.REPL), ext.REPL);
    });
  });

  describe("resolveRunTarget", () => {
    const unassignedUri = vscode.Uri.file("unassigned.q");
    const conn = <any>{ connLabel: "local" };
    let retrieveConnectedConnectionStub: sinon.SinonStub;

    beforeEach(() => {
      retrieveConnectedConnectionStub = sinon.stub(
        ConnectionManagementService.prototype,
        "retrieveConnectedConnection",
      );
      sinon.stub(notifications, "notify");
      setActiveTarget(undefined);
    });

    afterEach(() => {
      setActiveTarget(undefined);
      ext.connectionConsoles.clear();
    });

    it("should return the REPL for a file assigned to the REPL", async () => {
      const result = await workspaceCommand.resolveRunTarget(replUri);
      assert.deepStrictEqual(result, { kind: "repl" });
    });

    it("should return the REPL a file is pinned to", async () => {
      const result = await workspaceCommand.resolveRunTarget(pinnedUri);
      assert.deepStrictEqual(result, { kind: "repl", label: "test/folderA" });
    });

    it("should return the connection a file is assigned to", async () => {
      retrieveConnectedConnectionStub.returns(conn);
      const result = await workspaceCommand.resolveRunTarget(kdbUri);
      assert.deepStrictEqual(result, { kind: "connection", conn });
    });

    it("should return undefined when the assigned connection is not connected", async () => {
      retrieveConnectedConnectionStub.returns(undefined);
      sinon.stub(coreUtils, "offerConnectAction").resolves(false);
      const result = await workspaceCommand.resolveRunTarget(kdbUri);
      assert.strictEqual(result, undefined);
    });

    it("should fall back to the active connection target", async () => {
      ext.connectionConsoles.set("local", <any>{});
      setActiveTarget({ kind: "connection", connLabel: "local" });
      retrieveConnectedConnectionStub.returns(conn);

      const result = await workspaceCommand.resolveRunTarget(unassignedUri);
      assert.deepStrictEqual(result, { kind: "connection", conn });
    });

    it("should fall back to the REPL when the active connection is gone", async () => {
      ext.connectionConsoles.set("local", <any>{});
      setActiveTarget({ kind: "connection", connLabel: "local" });
      retrieveConnectedConnectionStub.returns(undefined);

      const result = await workspaceCommand.resolveRunTarget(unassignedUri);
      assert.deepStrictEqual(result, { kind: "repl" });
    });

    it("should fall back to the REPL when there is no active target", async () => {
      const result = await workspaceCommand.resolveRunTarget(unassignedUri);
      assert.deepStrictEqual(result, { kind: "repl" });
    });
  });
});
