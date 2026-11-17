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
import * as sinon from "sinon";
import * as vscode from "vscode";

import { LocalConnection } from "../../../src/classes/localConnection";
import { ext } from "../../../src/extensionVariables";
import { ConnectionManagementService } from "../../../src/services/connectionManagerService";
import {
  KdbNode,
  KdbTreeProvider,
} from "../../../src/services/kdbTreeProvider";
import AuthSettings from "../../../src/utils/secretStorage";

describe("ConnectionManagementService", () => {
  const connectionManagerService = new ConnectionManagementService();
  const servers = {
    testServer: {
      serverAlias: "testLabel",
      serverName: "127.0.0.1",
      serverPort: "5001",
      tls: false,
      auth: false,
      managed: false,
    },
  };
  const kdbNode = new KdbNode(
    ["child1"],
    "testLabel",
    servers["testServer"],
    vscode.TreeItemCollapsibleState.None,
  );
  const localConn = new LocalConnection("127.0.0.1:5001", "testLabel", []);

  ext.serverProvider = new KdbTreeProvider(servers);

  describe("retrieveConnection", () => {
    afterEach(() => {
      ext.connectionsList.length = 0;
    });

    it("Should return undefined when connection is not found", () => {
      const result = connectionManagerService.retrieveConnection("testLabel");

      assert.strictEqual(result, undefined);
    });

    it("Should return the connection when found", () => {
      ext.connectionsList.push(kdbNode);
      const result = connectionManagerService.retrieveConnection(kdbNode.label);

      assert.strictEqual(result, kdbNode);
    });
  });

  describe("retrieveConnectedConnection", () => {
    afterEach(() => {
      ext.connectedConnectionList.length = 0;
    });

    it("Should return undefined when connection is not found", () => {
      const result =
        connectionManagerService.retrieveConnectedConnection("testLabel");

      assert.strictEqual(result, undefined);
    });

    it("Should return the connection when found", () => {
      ext.connectedConnectionList.push(localConn);
      const result =
        connectionManagerService.retrieveConnectedConnection("testLabel");

      assert.strictEqual(result, localConn);
    });
  });

  describe("isKdbConnection", () => {
    it("Should return true for KDB connection", () => {
      const result = connectionManagerService.isKdbConnection(kdbNode);

      assert.strictEqual(result, true);
    });
  });

  describe("retrieveLocalConnectionString", () => {
    it("Should return the connection string", () => {
      const result =
        connectionManagerService.retrieveLocalConnectionString(kdbNode);

      assert.strictEqual(result, "127.0.0.1:5001");
    });
  });

  describe("retrieveListOfConnectionsNames", () => {
    it("Should return the list of connection names", () => {
      ext.connectionsList.push(kdbNode);
      const result = connectionManagerService.retrieveListOfConnectionsNames();

      assert.strictEqual(result.size, 1);
      ext.connectionsList.length = 0;
    });
  });

  describe("checkConnAlias", () => {
    it("Should return local when connection is kdb and alias equals local and local conn not exist already", () => {
      const result = connectionManagerService.checkConnAlias("local", false);

      assert.strictEqual(result, "local");
    });

    it("Should return localKDB when connection is kdb and alias equals local and local conn exist already", () => {
      const result = connectionManagerService.checkConnAlias("local", true);

      assert.strictEqual(result, "localKDB");
    });
  });

  describe("removeConnectionFromContextString", () => {
    it("Should remove the connection from context string", () => {
      ext.connectedContextStrings.push("testLabel");
      connectionManagerService.removeConnectionFromContextString("testLabel");
      assert.strictEqual(ext.connectedContextStrings.length, 0);
      ext.connectedContextStrings.length = 0;
    });
  });

  describe("connect", () => {
    afterEach(() => {
      ext.connectedContextStrings.length = 0;
      ext.connectionNode = undefined;
      ext.connectedConnectionList.length = 0;
      sinon.restore();
    });

    it("Should not connect if connection does not exist", async () => {
      const result = await connectionManagerService.connect("testLabel");

      assert.strictEqual(result, undefined);
    });
  });

  describe("setActiveConnection", () => {
    beforeEach(() => {
      ext.activeConnection = undefined;
    });

    afterEach(() => {
      ext.connectionNode = undefined;
      sinon.restore();
    });

    it("Should not set active connection if connection does not exist", () => {
      connectionManagerService.setActiveConnection(kdbNode);
      assert.strictEqual(ext.activeConnection, undefined);
    });

    it("Should set active connection", () => {
      ext.serverProvider = new KdbTreeProvider(servers);
      sinon
        .stub(connectionManagerService, "retrieveConnectedConnection")
        .returns(localConn);
      connectionManagerService.setActiveConnection(kdbNode);
      assert.strictEqual(ext.activeConnection, localConn);
    });
  });

  describe("clearActiveConnection", () => {
    beforeEach(() => {
      ext.activeConnection = undefined;
      ext.serverProvider = new KdbTreeProvider(servers);
    });

    afterEach(() => {
      ext.activeConnection = undefined;
      ext.connectionNode = undefined;
      sinon.restore();
    });

    it("Should do nothing if there is no active connection", () => {
      const connSpy = sinon.spy(localConn, "setInactive");
      connectionManagerService.clearActiveConnection();
      sinon.assert.notCalled(connSpy);
    });

    it("Should clear the active connection and set it as inactive", () => {
      ext.activeConnection = localConn;
      ext.connectionNode = kdbNode;

      const connSpy = sinon.spy(localConn, "setInactive");
      connectionManagerService.clearActiveConnection();

      sinon.assert.calledOnce(connSpy);
      assert.strictEqual(ext.activeConnection, undefined);
      assert.strictEqual(ext.connectionNode, undefined);
    });
  });

  describe("disconnect", () => {
    let retrieveConnectionStub,
      retrieveConnectedConnectionStub: sinon.SinonStub;

    beforeEach(() => {
      retrieveConnectionStub = sinon.stub(
        connectionManagerService,
        "retrieveConnection",
      );
      retrieveConnectedConnectionStub = sinon.stub(
        connectionManagerService,
        "retrieveConnectedConnection",
      );
    });

    afterEach(() => {
      ext.connectedContextStrings.length = 0;
      ext.connectionNode = undefined;
      ext.connectedConnectionList.length = 0;
      sinon.restore();
    });

    it("Should not disconnect if connection does not exist", async () => {
      retrieveConnectedConnectionStub.returns(undefined);
      retrieveConnectionStub.returns(undefined);
      const result = await connectionManagerService.disconnect("testLabel");

      assert.strictEqual(result, undefined);
    });

    it("Should disconnect a connection whose tree node is gone", () => {
      const disconnect = sinon.stub(localConn, "disconnect");
      const disconnectBehaviour = sinon.stub(
        connectionManagerService,
        "disconnectBehaviour",
      );
      retrieveConnectedConnectionStub.returns(localConn);
      retrieveConnectionStub.returns(undefined);

      connectionManagerService.disconnect(localConn.connLabel);

      sinon.assert.calledOnce(disconnect);
      sinon.assert.calledOnceWithExactly(disconnectBehaviour, localConn);
    });
  });

  describe("executeQuery", () => {
    const command = "testCommand";
    const context = "testContext";
    const stringfy = true;

    let executeQueryStub;

    beforeEach(() => {
      executeQueryStub = sinon.stub(localConn, "executeQuery");
    });

    afterEach(() => {
      ext.activeConnection = undefined;
      sinon.restore();
    });

    it("Should not execute query if connection does not exist", async () => {
      ext.activeConnection = undefined;
      const result = await connectionManagerService.executeQuery(
        command,
        "connTest",
        context,
        stringfy,
      );

      assert.strictEqual(result, undefined);
    });

    it("Should execute query from kdbNode", async () => {
      ext.activeConnection = localConn;
      executeQueryStub.returns("test results");
      const result = await connectionManagerService.executeQuery(
        command,
        undefined,
        context,
        stringfy,
      );

      assert.strictEqual(result, "test results");
    });
  });

  describe("behaviour methods", () => {
    beforeEach(() => {
      ext.serverProvider = new KdbTreeProvider(servers);
    });

    afterEach(() => {
      sinon.restore();
      ext.connectedConnectionList.length = 0;
      ext.activeConnection = undefined;

      ext.serverProvider = undefined;
    });

    it("connectFailBehaviour", () => {
      const showErrorMessageStub = sinon.stub(
        vscode.window,
        "showErrorMessage",
      );
      const testLabel = "testLabel";

      connectionManagerService.connectFailBehaviour(testLabel);
      sinon.assert.calledWith(
        showErrorMessageStub,
        `Connection to ${testLabel} failed.`,
      );
    });

    it("disconnectBehaviour", () => {
      const testConnection = new LocalConnection(
        "localhost:5001",
        "server1",
        [],
      );

      ext.connectedConnectionList.push(testConnection);
      ext.activeConnection = testConnection;
      connectionManagerService.disconnectBehaviour(testConnection);
      assert.equal(ext.connectedConnectionList.length, 0);
      assert.equal(ext.activeConnection, undefined);
      assert.equal(ext.connectionNode, undefined);
    });
  });

  describe("retrieveUserPass", () => {
    let connectionManagerService: ConnectionManagementService;
    let connectionsListStub: sinon.SinonStub;
    let getAuthDataStub: sinon.SinonStub;
    let _kdbAuthMapStub: sinon.SinonStub;
    let _contextStub: sinon.SinonStub;
    ext.context = {} as vscode.ExtensionContext;

    beforeEach(() => {
      _contextStub = sinon.stub(ext, "context").value({
        globalStorageUri: {
          fsPath: "/temp/",
        },
      });
      AuthSettings.init(ext.context);
      ext.secretSettings = AuthSettings.instance;
      connectionManagerService = new ConnectionManagementService();
      connectionsListStub = sinon.stub(ext, "connectionsList").value([]);
      getAuthDataStub = sinon.stub(ext.secretSettings, "getAuthData");
      _kdbAuthMapStub = sinon.stub(ext, "kdbAuthMap").value([]);
    });

    afterEach(() => {
      sinon.restore();
      ext.connectionsList.length = 0;
    });

    it("should retrieve and store auth data for KdbNode connections", async () => {
      ext.connectionsList.push(kdbNode);
      getAuthDataStub.withArgs(kdbNode.children[0]).resolves("user1:pass1");
      await connectionManagerService.retrieveUserPass();
      assert.strictEqual(ext.kdbAuthMap.length, 1);
      assert.deepEqual(ext.kdbAuthMap[0], {
        child1: {
          username: "user1",
          password: "pass1",
        },
      });
    });

    it("should not store auth data if getAuthData returns null", async () => {
      connectionsListStub.value([kdbNode]);
      getAuthDataStub.withArgs("server1").resolves(null);
      await connectionManagerService.retrieveUserPass();
      assert.strictEqual(ext.kdbAuthMap.length, 0);
    });

    it("should not store auth data for non-KdbNode connections", async () => {
      const nonKdbNode = { children: ["server1"] };

      connectionsListStub.value([nonKdbNode]);
      await connectionManagerService.retrieveUserPass();
      assert.strictEqual(ext.kdbAuthMap.length, 0);
    });
  });

  describe("exportConnection", () => {
    let retrieveConnectionStub: sinon.SinonStub;
    let connectionsListStub: sinon.SinonStub;
    let kdbAuthMapStub: sinon.SinonStub;

    beforeEach(() => {
      retrieveConnectionStub = sinon.stub(
        connectionManagerService,
        "retrieveConnection",
      );
      connectionsListStub = sinon.stub(ext, "connectionsList").value([]);
      kdbAuthMapStub = sinon.stub(ext, "kdbAuthMap").value([]);
    });

    afterEach(() => {
      sinon.restore();
    });

    it("should export all connections when connLabel is not provided", () => {
      connectionsListStub.value([kdbNode]);
      const result = connectionManagerService.exportConnection();
      const expectedOutput = {
        connections: {
          KDB: [kdbNode.details],
        },
      };

      assert.strictEqual(result, JSON.stringify(expectedOutput, null, 2));
    });

    it("should return empty string if connLabel is provided and connection is not found", () => {
      retrieveConnectionStub.withArgs("nonExistentLabel").returns(null);
      const result =
        connectionManagerService.exportConnection("nonExistentLabel");

      assert.strictEqual(result, "");
    });

    it("should export KDB connection when connLabel is provided and connection is an instance of KdbNode", () => {
      kdbNode.details.auth = true;
      retrieveConnectionStub.withArgs("kdbLabel").returns(kdbNode);
      const result = connectionManagerService.exportConnection("kdbLabel");
      const expectedOutput = {
        connections: {
          KDB: [kdbNode.details],
        },
      };

      assert.strictEqual(result, JSON.stringify(expectedOutput, null, 2));
    });

    it("should return empty string if connLabel is not provided and connectionsList is empty", () => {
      connectionsListStub.value([]);
      const result = connectionManagerService.exportConnection();

      assert.strictEqual(result, "");
    });

    it("should set auth to false and clear username and password if includeAuth is false", () => {
      connectionsListStub.value([kdbNode]);
      const result = connectionManagerService.exportConnection(
        undefined,
        false,
      );
      const expectedOutput = {
        connections: {
          KDB: [kdbNode.details],
        },
      };

      assert.strictEqual(result, JSON.stringify(expectedOutput, null, 2));
    });

    it("should set auth to true and populate username and password if includeAuth is true and auth is found", () => {
      const authData = {
        server1: {
          username: "user1",
          password: "pass1",
        },
      };

      connectionsListStub.value([kdbNode]);
      kdbAuthMapStub.value([authData]);
      const result = connectionManagerService.exportConnection(undefined, true);
      const expectedOutput = {
        connections: {
          KDB: [kdbNode.details],
        },
      };

      assert.strictEqual(result, JSON.stringify(expectedOutput, null, 2));
    });

    it("should not change auth, username, and password if includeAuth is true and auth is not found", () => {
      connectionsListStub.value([kdbNode]);
      kdbAuthMapStub.value([]);
      const result = connectionManagerService.exportConnection(undefined, true);
      const expectedOutput = {
        connections: {
          KDB: [kdbNode.details],
        },
      };

      assert.strictEqual(result, JSON.stringify(expectedOutput, null, 2));
    });

    it("should clear kdbAuthMap after processing", () => {
      const authData = {
        server1: {
          username: "user1",
          password: "pass1",
        },
      };

      connectionsListStub.value([kdbNode]);
      kdbAuthMapStub.value([authData]);
      connectionManagerService.exportConnection(undefined, true);
      assert.strictEqual(ext.kdbAuthMap.length, 0);
    });
  });
});
