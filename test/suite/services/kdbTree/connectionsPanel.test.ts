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
import * as path from "path";
import * as sinon from "sinon";
import * as vscode from "vscode";

import { ext } from "../../../../src/extensionVariables";
import { Server } from "../../../../src/models/connectionsModels";
import {
  KdbNode,
  KdbTreeProvider,
} from "../../../../src/services/kdbTreeProvider";
import { getServers } from "../../../../src/utils/core";
import {
  KDB_ALIASES,
  SORTED_ALIASES,
  declaredConnections,
} from "../../../fixtures/config/connections";

/**
 * What the connections panel shows for a list of pre-existing connections:
 * the order the connections come out in, the label each one carries and the
 * icon it is drawn with.
 *
 * These live here rather than in test/e2e because a tree provider's items are
 * not reachable from another extension host — VS Code exposes no API for the
 * contents of a view. So the panel is driven at its source: the same
 * getServers() activation builds the provider from, and the
 * same getChildren() the view calls.
 */
describe("connections panel", () => {
  let stored: { servers: Server };

  const declare = (servers: Server) =>
    sinon.stub(vscode.workspace, "getConfiguration").returns(<any>{
      get: (section: string, fallback?: unknown) => {
        switch (section) {
          case "kdb.servers":
            return servers;
          default:
            return fallback;
        }
      },
      update: sinon.stub(),
    });

  const shown = async () => {
    const provider = new KdbTreeProvider(getServers());
    return <KdbNode[]>await provider.getChildren();
  };

  const aliasOf = (node: KdbNode) => node.details.serverAlias;

  const iconOf = (node: KdbNode) =>
    path.basename((<{ dark: vscode.Uri }>node.iconPath).dark.fsPath);

  beforeEach(() => {
    stored = declaredConnections();

    ext.connectionsList.length = 0;
    ext.kdbConnectionAliasList.length = 0;
    ext.kdbrootNodes.length = 0;
    ext.connLabelList.length = 0;
    ext.connectedConnectionList.length = 0;
    ext.activeConnection = undefined;
    ext.connectionNode = undefined;
  });

  afterEach(() => {
    sinon.restore();
    ext.connectionsList.length = 0;
    ext.kdbConnectionAliasList.length = 0;
    ext.kdbrootNodes.length = 0;
    ext.connectedConnectionList.length = 0;
    ext.activeConnection = undefined;
    ext.connectionNode = undefined;
  });

  describe("order", () => {
    it("sorts the connections alphabetically", async () => {
      declare(stored.servers);

      const aliases = (await shown()).map(aliasOf);

      assert.deepStrictEqual(aliases, SORTED_ALIASES);
    });

    it("sorts the connections alphabetically whatever order they are stored in", async () => {
      const reverse = <T>(list: { [key: string]: T }): { [key: string]: T } =>
        Object.fromEntries(Object.entries(list).reverse());

      declare(reverse(stored.servers));

      const aliases = (await shown()).map(aliasOf);

      assert.deepStrictEqual(aliases, SORTED_ALIASES);
    });
  });

  describe("labels", () => {
    it("shows the name given to a q connection before its server details", async () => {
      declare(stored.servers);

      const labels = (await shown())
        .filter((node) => node instanceof KdbNode)
        .map((node) => node.label);

      assert.deepStrictEqual(labels, [
        "alpha-q [127.0.0.1:25102]",
        "mike-q [localhost:25103]",
        "zulu-q [127.0.0.1:25101]",
      ]);
    });

    it("shows only the server details for a q connection with no name", async () => {
      declare({
        "": {
          serverAlias: "",
          serverName: "127.0.0.1",
          serverPort: "5001",
          auth: false,
          tls: false,
        },
      });

      const [node] = await shown();

      assert.strictEqual(node.label, "[127.0.0.1:5001]");
    });
  });

  describe("icons", () => {
    it("draws each connection with the icon for its type", async () => {
      declare(stored.servers);

      const icons = (await shown()).map(iconOf);

      assert.deepStrictEqual(icons, [...KDB_ALIASES.map(() => "conn-kdb.svg")]);
    });

    it("draws a connected connection with the connected icon", async () => {
      declare(stored.servers);
      ext.connectedConnectionList.push(<any>{
        connLabel: "zulu-q [127.0.0.1:25101]",
      });

      const icons = new Map(
        (await shown()).map((node) => [node.label, iconOf(node)]),
      );

      assert.strictEqual(
        icons.get("zulu-q [127.0.0.1:25101]"),
        "conn-kdb-connected.svg",
      );
      assert.strictEqual(
        icons.get("alpha-q [127.0.0.1:25102]"),
        "conn-kdb.svg",
      );
    });

    it("draws the active connection with the active icon", async () => {
      declare(stored.servers);
      const active = <any>{ connLabel: "zulu-q [127.0.0.1:25101]" };
      ext.connectedConnectionList.push(active);
      ext.activeConnection = active;

      const icons = new Map(
        (await shown()).map((node) => [node.label, iconOf(node)]),
      );

      assert.strictEqual(
        icons.get("zulu-q [127.0.0.1:25101]"),
        "conn-kdb-active.svg",
      );
      assert.strictEqual(
        icons.get("alpha-q [127.0.0.1:25102]"),
        "conn-kdb.svg",
      );
    });
  });
});
