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

import assert from "assert";
import mock from "mock-fs";
import * as sinon from "sinon";
import * as vscode from "vscode";

import { LocalConnection } from "../../../src/classes/localConnection";
import * as serverCommand from "../../../src/commands/serverCommand";
import { ext } from "../../../src/extensionVariables";
import {
  ExportedConnections,
  ServerDetails,
  ServerType,
} from "../../../src/models/connectionsModels";
import { ExecutionTypes } from "../../../src/models/execution";
import { QueryHistory } from "../../../src/models/queryHistory";
import { NewConnectionPannel } from "../../../src/panels/newConnection";
import { ConnectionManagementService } from "../../../src/services/connectionManagerService";
import {
  KdbNode,
  KdbTreeProvider,
} from "../../../src/services/kdbTreeProvider";
import { KdbResultsViewProvider } from "../../../src/services/resultsPanelProvider";
import * as coreUtils from "../../../src/utils/core";
import { ExecutionConsole } from "../../../src/utils/executionConsole";
import * as loggers from "../../../src/utils/loggers";
import * as notifications from "../../../src/utils/notifications";
import * as kdbValidators from "../../../src/validators/kdbValidator";

describe("serverCommand", () => {
  const servers = {
    testServer: {
      serverAlias: "testServerAlias",
      serverName: "testServerName",
      serverPort: "5001",
      tls: false,
      auth: false,
      managed: false,
    },
  };
  const kdbNode = new KdbNode(
    ["child1"],
    "testElement",
    servers["testServer"],
    vscode.TreeItemCollapsibleState.None,
  );
  ext.serverProvider = new KdbTreeProvider(servers);

  after(() => {
    ext.serverProvider = undefined;
  });

  it("should call the New Connection Panel Renderer", async () => {
    const newConnectionPanelStub = sinon.stub(NewConnectionPannel, "render");
    ext.context = <vscode.ExtensionContext>{};
    await serverCommand.addNewConnection();
    sinon.assert.calledOnce(newConnectionPanelStub);
    sinon.restore();
  });

  it("should call the Edit Connection Panel Renderer", async () => {
    const newConnectionPanelStub = sinon.stub(NewConnectionPannel, "render");
    ext.context = <vscode.ExtensionContext>{};
    await serverCommand.editConnection(kdbNode);
    sinon.assert.calledOnce(newConnectionPanelStub);
    sinon.restore();
  });

  describe("isConnected", () => {
    let connMngServiceMock: sinon.SinonStubbedInstance<ConnectionManagementService>;

    beforeEach(() => {
      connMngServiceMock = sinon.createStubInstance(
        ConnectionManagementService,
      );
    });

    it("deve retornar false quando isConnected do ConnectionManagementService retornar false", () => {
      connMngServiceMock.isConnected.returns(false);
      const result = serverCommand.isConnected("127.0.0.1:6812 [CONNLABEL]");
      assert.deepStrictEqual(result, false);
    });
  });

  describe("addKdbConnection", () => {
    let kdbData: ServerDetails;
    let windowMock: sinon.SinonMock;
    let updateServersStub,
      getServersStub,
      validationServerAliasStub,
      validationHostnameStub,
      validationPortStub: sinon.SinonStub;
    beforeEach(() => {
      kdbData = {
        serverName: "testServer",
        serverAlias: "testServerAlias",
        auth: false,
        serverPort: "5001",
        tls: false,
      };
      windowMock = sinon.mock(vscode.window);
      updateServersStub = sinon.stub(coreUtils, "updateServers");
      getServersStub = sinon.stub(coreUtils, "getServers");
      validationServerAliasStub = sinon.stub(
        kdbValidators,
        "validateServerAlias",
      );
      validationHostnameStub = sinon.stub(kdbValidators, "validateServerName");
      validationPortStub = sinon.stub(kdbValidators, "validateServerPort");
    });

    afterEach(() => {
      sinon.restore();
      windowMock.restore();
    });

    it("should add new Kdb connection", async () => {
      getServersStub.returns({});
      validationServerAliasStub.returns(false);
      validationHostnameStub.returns(false);
      validationPortStub.returns(false);
      await serverCommand.addKdbConnection(kdbData, ["lblTest"]);
      sinon.assert.calledOnce(updateServersStub);
      windowMock
        .expects("showInformationMessage")
        .once()
        .withArgs("Kdb connection added successfully");
    });

    it("should show error message if Kdb connection already exists", async () => {
      getServersStub.returns(servers);
      await serverCommand.addKdbConnection(kdbData);
      windowMock
        .expects("showErrorMessage")
        .once()
        .withArgs("Kdb connection already exists");
    });

    it("should show error message if Kdb connection is invalid", async () => {
      kdbData.serverPort = "invalid";
      await serverCommand.addKdbConnection(kdbData);
      windowMock
        .expects("showErrorMessage")
        .once()
        .withArgs("Invalid Kdb connection");
    });

    it("should show error message if connection where alias is not provided", async () => {
      kdbData.serverAlias = "";
      await serverCommand.addKdbConnection(kdbData);
      windowMock
        .expects("showErrorMessage")
        .once()
        .withArgs("Server Name is required");
    });

    it("should add authentication to the connection", async () => {
      kdbData.auth = true;
      kdbData.password = "password";
      kdbData.username = "username";
      getServersStub.returns({});
      await serverCommand.addKdbConnection(kdbData);
      sinon.assert.called(updateServersStub);
      windowMock
        .expects("showInformationMessage")
        .once()
        .withArgs("Kdb connection added successfully");
    });

    it("should return error when the servername with an invalid length", async () => {
      kdbData.serverName = "";
      await serverCommand.addKdbConnection(kdbData);
      windowMock
        .expects("showErrorMessage")
        .once()
        .withArgs("Invalid Kdb connection");
    });

    it("should return error when the servername with an invalid length", async () => {
      kdbData.serverName = "a".repeat(kdbValidators.MAX_STR_LEN + 1);
      await serverCommand.addKdbConnection(kdbData);
      windowMock
        .expects("showErrorMessage")
        .once()
        .withArgs("Invalid Kdb connection");
    });
  });

  describe("importConnections", () => {
    let showOpenDialogStub,
      kdbOutputLogStub,
      _addImportedConnectionsStub: sinon.SinonStub;

    beforeEach(() => {
      showOpenDialogStub = sinon.stub(vscode.window, "showOpenDialog");
      kdbOutputLogStub = sinon.stub(loggers, "kdbOutputLog");
      _addImportedConnectionsStub = sinon.stub(
        serverCommand,
        "addImportedConnections",
      );
    });

    afterEach(() => {
      sinon.restore();
      mock.restore();
    });

    it("should log an error if no file is selected", async () => {
      showOpenDialogStub.resolves(undefined);

      await serverCommand.importConnections();

      assert(
        kdbOutputLogStub.calledWith(
          "[serverCommand] No file selected.",
          "ERROR",
          true,
        ),
      );
    });
  });

  describe("addImportedConnections", async () => {
    let addKdbConnectionStub,
      kdbOutputLogStub,
      showInformationMessageStub,
      _getServersStub: sinon.SinonStub;

    const kdbNodeImport1: KdbNode = {
      label: "local",
      details: {
        serverName: "testKdb",
        serverAlias: "local",
        serverPort: "1818",
        auth: false,
        tls: false,
      },
      collapsibleState: vscode.TreeItemCollapsibleState.None,
      contextValue: "kdbNode",
      children: [],
      getTooltip: function (): vscode.MarkdownString {
        throw new Error("Function not implemented.");
      },
      getDescription: function (): string {
        throw new Error("Function not implemented.");
      },
      iconPath: undefined,
    };

    beforeEach(() => {
      addKdbConnectionStub = sinon.stub(serverCommand, "addKdbConnection");
      kdbOutputLogStub = sinon.stub(loggers, "kdbOutputLog");
      _getServersStub = sinon.stub(coreUtils, "getServers").returns(undefined);
      showInformationMessageStub = sinon.stub(
        vscode.window,
        "showInformationMessage",
      );
      ext.connectionsList.length = 0;
    });

    afterEach(() => {
      sinon.restore();
      ext.connectionsList.length = 0;
    });
    it("should log success message and show information message", async () => {
      const importedConnections: ExportedConnections = {
        connections: {
          KDB: [],
        },
      };

      await serverCommand.addImportedConnections(importedConnections);

      assert(
        kdbOutputLogStub.calledWith(
          "[serverCommand] Connections imported successfully.",
          "INFO",
        ),
      );
      assert(
        showInformationMessageStub.calledWith(
          "Connections imported successfully.",
        ),
      );
    });

    it("should add kdb connections", () => {
      ext.connectionsList.push(kdbNodeImport1);
      const importedConnections: ExportedConnections = {
        connections: {
          KDB: [
            {
              serverName: "testKdb",
              serverAlias: "testKdb",
              serverPort: "1818",
              auth: false,
              tls: false,
            },
          ],
        },
      };

      assert.doesNotThrow(() =>
        serverCommand.addImportedConnections(importedConnections),
      );
    });

    it("should overwrite connections", async () => {
      ext.connectionsList.push(kdbNodeImport1);
      const importedConnections: ExportedConnections = {
        connections: {
          KDB: [
            {
              serverName: "testKdb",
              serverAlias: "testKdb",
              serverPort: "1818",
              auth: false,
              tls: false,
            },
          ],
        },
      };

      showInformationMessageStub.returns("Overwrite");
      await serverCommand.addImportedConnections(importedConnections);
      sinon.assert.notCalled(addKdbConnectionStub);
    });
  });

  describe("writeQueryResultsToView", () => {
    it("should call executeCommand with correct arguments", () => {
      const result = { data: [1, 2, 3] };
      const executeCommandStub = sinon.stub(vscode.commands, "executeCommand");

      serverCommand.writeQueryResultsToView(
        result,
        "",
        "testConn",
        "testFile.kdb.q",
        false,
        "WORKBOOK",
        false,
        "2",
      );

      sinon.assert.calledWith(
        executeCommandStub.firstCall,
        "kdb.resultsPanel.update",
        result,
        false,
      );

      executeCommandStub.restore();
    });

    it("should call executeCommand with correct arguments for an error", () => {
      const result = "Error: test error";
      const executeCommandStub = sinon.stub(vscode.commands, "executeCommand");

      serverCommand.writeQueryResultsToView(
        result,
        "",
        "testConn",
        "testFile.kdb.q",
        false,
        "WORKBOOK",
        false,
        "2",
      );

      sinon.assert.calledWith(
        executeCommandStub.firstCall,
        "kdb.resultsPanel.update",
        result,
        false,
      );

      executeCommandStub.restore();
    });
  });

  describe("enableTLS", () => {
    let getServersStub,
      updateServersStub,
      showErrorMessageStub: sinon.SinonStub;

    beforeEach(() => {
      getServersStub = sinon.stub(coreUtils, "getServers");
      updateServersStub = sinon.stub(coreUtils, "updateServers");
      showErrorMessageStub = sinon.stub(vscode.window, "showErrorMessage");
    });

    afterEach(() => {
      getServersStub.restore();
      updateServersStub.restore();
      showErrorMessageStub.restore();
    });

    it("should show error message when OpenSSL is not found", async () => {
      ext.openSslVersion = null;
      showErrorMessageStub.resolves("More Info");

      await serverCommand.enableTLS("test");

      sinon.assert.calledOnce(showErrorMessageStub);
      sinon.assert.calledWith(
        showErrorMessageStub,
        "OpenSSL not found, please ensure this is installed",
        "More Info",
        "Cancel",
      );
      sinon.assert.notCalled(updateServersStub);
    });

    it("should show error message when server is not found", async () => {
      ext.openSslVersion = "1.0.2";
      getServersStub.returns({});

      await serverCommand.enableTLS("test");

      sinon.assert.calledOnce(showErrorMessageStub);
      sinon.assert.calledWith(
        showErrorMessageStub,
        "Server not found, please ensure this is a correct server",
        "Cancel",
      );
      sinon.assert.calledOnce(getServersStub);
      sinon.assert.notCalled(updateServersStub);
    });

    it("should update server with correct arguments", async () => {
      const servers = {
        testServer: {
          serverAlias: "testServerAlias",
          serverName: "testServerName",
          serverPort: "5001",
          tls: false,
          auth: false,
          managed: false,
        },
      };
      ext.serverProvider = new KdbTreeProvider(servers);
      ext.openSslVersion = "1.0.2";
      getServersStub.returns({
        test: {
          auth: true,
          tls: false,
          serverName: "test",
          serverPort: "1001",
          serverAlias: "testando",
          managed: false,
        },
      });
      await serverCommand.enableTLS("test");
      sinon.assert.calledOnce(updateServersStub);
    });
  });

  describe("runQuery", () => {
    const editor = <vscode.TextEditor>(<unknown>{
      selection: {
        isEmpty: false,
        active: { line: 5 },
        start: { line: 5 },
        end: sinon.stub().returns({ line: 10 }),
      },
      document: {
        lineAt: sinon.stub().returns({ text: "SELECT * FROM table" }),
        getText: sinon.stub().returns("SELECT * FROM table"),
      },
    });

    let getQueryContextStub, executeQueryStub: sinon.SinonStub;

    beforeEach(() => {
      ext.activeTextEditor = editor;
      getQueryContextStub = sinon
        .stub(serverCommand, "getQueryContext")
        .returns(".");
      executeQueryStub = sinon
        .stub(serverCommand, "executeQuery")
        .resolves(undefined);
    });

    afterEach(() => {
      ext.activeTextEditor = undefined;
      getQueryContextStub.restore();
      executeQueryStub.restore();
    });

    it("runQuery with undefined editor ", async () => {
      ext.activeTextEditor = undefined;
      const result = await serverCommand.runQuery(
        ExecutionTypes.PythonQueryFile,
        "",
        "",
        false,
      );
      assert.equal(result, false);
    });

    it("runQuery with QuerySelection", async () => {
      ext.connectionNode = undefined;
      const result = await serverCommand.runQuery(
        ExecutionTypes.QuerySelection,
        "",
        "",
        false,
      );
      assert.equal(result, undefined);
    });

    it("runQuery with PythonQueryFile not connected to inisghts node", async () => {
      ext.connectionNode = undefined;
      const result = await serverCommand.runQuery(
        ExecutionTypes.PythonQuerySelection,
        "",
        "",
        false,
      );
      assert.equal(result, undefined);
    });

    it("runQuery with QueryFile", async () => {
      ext.connectionNode = undefined;
      const result = await serverCommand.runQuery(
        ExecutionTypes.QueryFile,
        "",
        "",
        false,
      );
      assert.equal(result, undefined);
    });

    it("runQuery with ReRunQuery", async () => {
      ext.connectionNode = undefined;
      const result = await serverCommand.runQuery(
        ExecutionTypes.ReRunQuery,
        "",
        "",
        false,
        "rerun query",
      );
      assert.equal(result, undefined);
    });

    it("runQuery with PythonQueryFile", async () => {
      ext.connectionNode = undefined;
      const result = await serverCommand.runQuery(
        ExecutionTypes.PythonQueryFile,
        "",
        "",
        false,
      );
      assert.equal(result, undefined);
    });
  });

  describe("executeQuery", () => {
    let isVisibleStub,
      executeQueryStub,
      writeResultsViewStub,
      writeResultsConsoleStub: sinon.SinonStub;
    const connMangService = new ConnectionManagementService();
    const localConn = new LocalConnection("localhost:5001", "server1", []);
    ext.resultsViewProvider = new KdbResultsViewProvider(
      vscode.Uri.parse("test"),
    );

    beforeEach(() => {
      isVisibleStub = sinon.stub(ext.resultsViewProvider, "isVisible");
      executeQueryStub = sinon.stub(connMangService, "executeQuery");
      writeResultsViewStub = sinon.stub(
        serverCommand,
        "writeQueryResultsToView",
      );
      writeResultsConsoleStub = sinon.stub(
        serverCommand,
        "writeQueryResultsToConsole",
      );
    });

    afterEach(() => {
      ext.activeConnection = undefined;
      ext.connectedConnectionList.length = 0;
      ext.connectedContextStrings.length = 0;
      sinon.restore();
    });

    it("should fail if connLabel is empty and activeConnection is undefined", async () => {
      serverCommand.executeQuery(
        "SELECT * FROM table",
        "",
        "testFile.kdb.q",
        ".",
        true,
        true,
      );
      sinon.assert.notCalled(writeResultsConsoleStub);
      sinon.assert.notCalled(writeResultsViewStub);
    });

    it("should proceed if connLabel is empty and activeConnection is not undefined", async () => {
      ext.activeConnection = localConn;
      ext.connectedConnectionList.push(localConn);
      ext.connectedContextStrings.push(localConn.connLabel);
      isVisibleStub.returns(true);
      executeQueryStub.resolves({ data: "data" });
      serverCommand.executeQuery(
        "SELECT * FROM table",
        "",
        "testFile.kdb.q",
        ".",
        true,
        true,
      );
      sinon.assert.notCalled(writeResultsConsoleStub);
    });
    it("should fail if the connection selected is not connected", async () => {
      ext.connectedConnectionList.push(localConn);
      isVisibleStub.returns(true);
      executeQueryStub.resolves({ data: "data" });
      serverCommand.executeQuery(
        "SELECT * FROM table",
        localConn.connLabel,
        "testFile.kdb.q",
        ".",
        true,
        true,
      );
      sinon.assert.notCalled(writeResultsConsoleStub);
      sinon.assert.notCalled(writeResultsViewStub);
    });
    it("should execute query and write results to view", async () => {
      ext.connectedConnectionList.push(localConn);
      ext.connectedContextStrings.push(localConn.connLabel);
      isVisibleStub.returns(true);
      executeQueryStub.resolves({ data: "data" });
      serverCommand.executeQuery(
        "SELECT * FROM table",
        localConn.connLabel,
        "testFile.kdb.q",
        ".",
        true,
        true,
      );
      sinon.assert.notCalled(writeResultsConsoleStub);
    });
    it("should execute query and write results to console", async () => {
      ext.connectedConnectionList.push(localConn);
      ext.connectedContextStrings.push(localConn.connLabel);
      isVisibleStub.returns(false);
      executeQueryStub.resolves("dummy test");
      serverCommand.executeQuery(
        "SELECT * FROM table",
        localConn.connLabel,
        "testFile.kdb.q",
        ".",
        true,
        true,
      );
      sinon.assert.notCalled(writeResultsViewStub);
    });

    it("should get error", async () => {
      ext.activeConnection = localConn;
      ext.connectionNode = kdbNode;
      const res = await serverCommand.executeQuery(
        "",
        "testeConn",
        "testFile.kdb.q",
        ".",
        true,
        true,
      );
      assert.equal(res, undefined);
    });
  });

  describe("getConextForRerunQuery", function () {
    it("should return correct context for given input", function () {
      assert.equal(serverCommand.getConextForRerunQuery("\\d .foo"), ".foo");
      assert.equal(
        serverCommand.getConextForRerunQuery('system "d .bar'),
        ".bar",
      );
    });

    it("should return default context for input without context", function () {
      assert.equal(
        serverCommand.getConextForRerunQuery("no context here"),
        ".",
      );
    });

    it("should return last context for input with multiple contexts", function () {
      assert.equal(
        serverCommand.getConextForRerunQuery("\\d .foo\n\\d .bar"),
        ".foo",
      );
    });

    it("should not take the next line as the context of a bare \\d", function () {
      assert.equal(serverCommand.getConextForRerunQuery("\\d\n123"), ".");
      assert.equal(
        serverCommand.getConextForRerunQuery('system "d\n.bar'),
        ".",
      );
    });

    it("should start in the root context when code comes before the first \\d", function () {
      assert.equal(serverCommand.getConextForRerunQuery("a:1\n\\d .foo"), ".");
    });

    it("should start in the first context when only comments come before it", function () {
      assert.equal(
        serverCommand.getConextForRerunQuery("/ setup\n/\nblock\n\\\n\\d .foo"),
        ".foo",
      );
    });
  });

  describe("getQueryContext", function () {
    function editorOf(text: string) {
      return <vscode.TextEditor>(<unknown>{
        document: {
          getText: () => text,
          lineAt: (line: number) => ({
            range: { end: { character: text.split("\n")[line].length } },
          }),
        },
      });
    }

    afterEach(() => {
      ext.activeTextEditor = undefined;
    });

    it("should use the context set above the line", function () {
      ext.activeTextEditor = editorOf("\\d .foo\n123");
      assert.equal(serverCommand.getQueryContext(1), ".foo");
    });

    it("should not take the line as the context of a bare \\d above it", function () {
      ext.activeTextEditor = editorOf("\\d\n123");
      assert.equal(serverCommand.getQueryContext(1), ".");
      assert.equal(serverCommand.getQueryContext(), ".");
    });
  });

  describe("rerunQuery", function () {
    this.afterEach(() => {
      sinon.restore();
    });

    it("should rerun a q query", async function () {
      const rerunQueryElement: QueryHistory = {
        executorName: "test",
        query: "SELECT * FROM table",
        language: "q",
        time: "",
        success: true,
        connectionName: "",
        connectionType: ServerType.KDB,
      };

      assert.doesNotThrow(() => serverCommand.rerunQuery(rerunQueryElement));
    });
  });

  describe("activeConnection", () => {
    let setActiveConnectionStub, reloadStub: sinon.SinonStub;

    beforeEach(() => {
      setActiveConnectionStub = sinon.stub(
        ConnectionManagementService.prototype,
        "setActiveConnection",
      );
      reloadStub = sinon.stub(ext.serverProvider, "reload");
    });
    afterEach(() => {
      sinon.restore();
    });

    it("should set active connection and reload the tree", () => {
      serverCommand.activeConnection(kdbNode);

      assert.ok(setActiveConnectionStub.calledWith(kdbNode));
      assert.ok(reloadStub.calledOnce);
    });
  });

  describe("disconnect", () => {
    let disconnectStub: sinon.SinonStub;

    beforeEach(() => {
      disconnectStub = sinon.stub(
        ConnectionManagementService.prototype,
        "disconnect",
      );
    });

    afterEach(() => {
      disconnectStub.restore();
    });

    it("should disconnect when ext.connectionNode", async () => {
      await serverCommand.disconnect("testLabel");

      assert.ok(disconnectStub.calledWith("testLabel"));
    });
  });

  describe("removeConnection", () => {
    let indexOfStub,
      _disconnectStub,
      getServersStub,
      getHashStub,
      getKeyStub,
      updateServersStub,
      refreshStub,
      notifyStub: sinon.SinonStub;

    beforeEach(() => {
      indexOfStub = sinon.stub(ext.connectedContextStrings, "indexOf");
      _disconnectStub = sinon.stub(serverCommand, "disconnect");
      getServersStub = sinon.stub(coreUtils, "getServers");
      getHashStub = sinon.stub(coreUtils, "getHash");
      getKeyStub = sinon.stub(coreUtils, "getKeyForServerName");
      updateServersStub = sinon.stub(coreUtils, "updateServers");
      refreshStub = sinon.stub(ext.serverProvider, "refresh");

      notifyStub = sinon.stub(notifications, "notify");
    });

    afterEach(() => {
      ext.activeConnection = undefined;
      ext.connectionNode = undefined;
      sinon.restore();
      ext.connectedContextStrings.length = 0;
    });

    it("should remove connection and refresh server provider when user clicks Proceed", async () => {
      notifyStub.resolves("Proceed");

      indexOfStub.returns(1);
      getServersStub.returns({ testKey: {} });
      getKeyStub.returns("testKey");

      await serverCommand.removeConnection(kdbNode);

      await new Promise((resolve) => setTimeout(resolve, 0));

      assert.ok(updateServersStub.calledOnce);
      assert.ok(refreshStub.calledOnce);
    });

    it("should remove connection, but disconnect it before when user clicks Proceed", async () => {
      notifyStub.resolves("Proceed");

      ext.connectedContextStrings.push(kdbNode.label);
      indexOfStub.returns(1);
      getServersStub.returns({ testKey: {} });
      getKeyStub.returns("testKey");

      await serverCommand.removeConnection(kdbNode);

      await new Promise((resolve) => setTimeout(resolve, 0));

      assert.ok(updateServersStub.calledOnce);
    });

    it("should not remove connection when user clicks Cancel", async () => {
      notifyStub.resolves("Cancel");

      getServersStub.returns({ testKey: {} });
      getKeyStub.returns("testKey");

      await serverCommand.removeConnection(kdbNode);

      await new Promise((resolve) => setTimeout(resolve, 0));

      assert.ok(updateServersStub.notCalled);
      assert.ok(refreshStub.notCalled);
    });

    it("should not remove connection when user dismisses dialog", async () => {
      notifyStub.resolves(undefined);

      getServersStub.returns({ testKey: {} });
      getKeyStub.returns("testKey");

      await serverCommand.removeConnection(kdbNode);

      await new Promise((resolve) => setTimeout(resolve, 0));

      assert.ok(updateServersStub.notCalled);
      assert.ok(refreshStub.notCalled);
    });
  });

  describe("connect", () => {
    const connService = new ConnectionManagementService();
    const _console = vscode.window.createOutputChannel("q Console Output");
    const _executionConsole = new ExecutionConsole(_console);
    let windowErrorStub, retrieveConnectionStub: sinon.SinonStub;

    beforeEach(() => {
      windowErrorStub = sinon.stub(vscode.window, "showErrorMessage");
      retrieveConnectionStub = sinon.stub(connService, "retrieveConnection");
      // connect() starts the console for real, which opens a fresh output
      // channel on a host that is no longer accepting them.
      sinon.stub(ExecutionConsole, "start").returns(_executionConsole);
    });

    afterEach(() => {
      sinon.restore();
    });

    it("should show error message if connection not found", async () => {
      retrieveConnectionStub.returns(undefined);
      await serverCommand.connect("test");
      assert.strictEqual(windowErrorStub.calledOnce, true);
    });
  });

  describe("exportConnections", () => {
    let sandbox: sinon.SinonSandbox;
    let kdbOutputLogStub: sinon.SinonStub;

    beforeEach(() => {
      sandbox = sinon.createSandbox();
      kdbOutputLogStub = sinon.stub(loggers, "kdbOutputLog");
    });

    afterEach(() => {
      sandbox.restore();
      sinon.restore();
      mock.restore();
    });

    it("should log an error when no connections are found", async () => {
      const exportConnectionStub = sandbox
        .stub(ConnectionManagementService.prototype, "exportConnection")
        .returns("");
      const showQuickPickStub = sandbox
        .stub(vscode.window, "showQuickPick")
        .resolves({ label: "No" });

      await serverCommand.exportConnections();

      sinon.assert.calledOnce(kdbOutputLogStub);
      sinon.assert.calledWith(
        kdbOutputLogStub,
        "[serverCommand] No connections found to be exported.",
        "ERROR",
      );

      exportConnectionStub.restore();
      showQuickPickStub.restore();
    });

    it("should log info when save operation is cancelled by the user", async () => {
      const exportConnectionStub = sandbox
        .stub(ConnectionManagementService.prototype, "exportConnection")
        .returns("{}");
      const showSaveDialogStub = sandbox
        .stub(vscode.window, "showSaveDialog")
        .resolves(undefined);
      const showQuickPickStub = sandbox
        .stub(vscode.window, "showQuickPick")
        .resolves({ label: "Yes" });

      await serverCommand.exportConnections();

      sinon.assert.calledOnce(kdbOutputLogStub);
      sinon.assert.calledWith(
        kdbOutputLogStub,
        "[serverCommand] Save operation was cancelled by the user.",
        "DEBUG",
      );

      exportConnectionStub.restore();
      showSaveDialogStub.restore();
      showQuickPickStub.restore();
    });
  });

  describe("copyQuery", () => {
    let showInfoStub: sinon.SinonStub;

    beforeEach(() => {
      showInfoStub = sinon.stub(vscode.window, "showInformationMessage");
    });

    afterEach(() => {
      sinon.restore();
    });

    it("should copy query to clipboard", async () => {
      const queryHistory: QueryHistory = {
        executorName: "test",
        connectionName: "conn",
        connectionType: ServerType.KDB,
        query: "select from table",
        time: "now",
        success: true,
      };

      serverCommand.copyQuery(queryHistory);
      sinon.assert.calledOnceWithExactly(
        showInfoStub,
        "Query copied to clipboard.",
        "Dismiss",
      );
    });
  });

  describe("ensureQuickConnection", () => {
    let secretSettings: any;
    let setAuthDataLabel: any;
    let setAuthDataAuth: any;
    beforeEach(() => {
      secretSettings = ext.secretSettings;
      ext.secretSettings = <any>{
        getAuthData() {
          return "test:1234";
        },
        storeAuthData(label: any, auth: any) {
          setAuthDataLabel = label;
          setAuthDataAuth = auth;
        },
      };
    });
    afterEach(() => {
      ext.secretSettings = secretSettings;
      secretSettings = undefined;
      setAuthDataAuth = undefined;
      setAuthDataLabel = undefined;
    });
    afterEach(() => {});
    it("should create quick connection", async () => {
      const label = await serverCommand.ensureQuickConnection("local:1234");
      assert.strictEqual(label, "(Connection 1)");
    });
    it("should create quick connection with auth", async () => {
      const label =
        await serverCommand.ensureQuickConnection("local:1234:test");
      assert.strictEqual(setAuthDataLabel, label);
      assert.strictEqual(setAuthDataAuth, "test:1234");
    });
  });
});
