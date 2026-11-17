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

import { commands } from "vscode";

import { setActiveTarget } from "../classes/activeTarget";
import { ConnectionConsole } from "../classes/connectionConsole";
import { LocalConnection } from "../classes/localConnection";
import { ext } from "../extensionVariables";
import { KdbNode } from "./kdbTreeProvider";
import {
  ExportedConnections,
  kdbAuthMap,
  Server,
} from "../models/connectionsModels";
import { retrieveConnLabelsNames } from "../utils/connLabel";
import {
  getKeyForServerName,
  getServers,
  updateServers,
  isQuickAlias,
} from "../utils/core";
import { MessageKind, notify } from "../utils/notifications";
import { sanitizeQuery } from "../utils/queryUtils";

const logger = "connectionManagerService";

export class ConnectionManagementService {
  public retrieveConnection(connLabel: string): KdbNode | undefined {
    return ext.connectionsList.find(
      (connections: KdbNode) => connLabel === connections.label,
    );
  }

  public retrieveConnectedConnection(
    connLabel: string,
  ): LocalConnection | undefined {
    return ext.connectedConnectionList.find((connection: LocalConnection) => {
      if (!connLabel) {
        return false;
      }
      const escapedConnLabel = connLabel.replace(
        /[-[\]{}()*+?.,\\^$|#\s]/g,
        "\\$&",
      );
      const regex = new RegExp(
        `\\d+\\.\\d+\\.\\d+\\.\\d+:\\d+ \\[${escapedConnLabel}\\]`,
      );
      return (
        connLabel === connection.connLabel || regex.test(connection.connLabel)
      );
    });
  }

  public retrieveListOfConnectionsNames(): Set<string> {
    return new Set(ext.connectionsList.map((conn) => conn.details.serverAlias));
  }

  public checkConnAlias(alias: string, localAlreadyExists?: boolean): string {
    return localAlreadyExists && alias === "local" ? alias + "KDB" : alias;
  }

  public isKdbConnection(connection: KdbNode): boolean {
    return connection instanceof KdbNode;
  }

  public isConnected(connLabel: string): boolean {
    const escapedConnLabel = connLabel.replace(
      /[-[\]{}()*+?.,\\^$|#\s]/g,
      "\\$&",
    );
    const regex = new RegExp(
      `\\d+\\.\\d+\\.\\d+\\.\\d+:\\d+ \\[${escapedConnLabel}\\]`,
    );
    return (
      ext.connectedContextStrings.includes(connLabel) ||
      ext.connectedContextStrings.some((context) => regex.test(context))
    );
  }

  public retrieveLocalConnectionString(connection: KdbNode): string {
    return connection.details.serverName + ":" + connection.details.serverPort;
  }

  public removeConnectionFromContextString(connLabel: string): void {
    const index = ext.connectedContextStrings.indexOf(connLabel);
    if (index > -1) {
      ext.connectedContextStrings.splice(index, 1);
    }
  }

  public async connect(connLabel: string): Promise<void> {
    /* c8 ignore start */
    try {
      const connection = this.retrieveConnection(connLabel);
      if (!connection) {
        this.connectFailBehaviour(
          connLabel,
          new Error(`Connection ${connLabel} not found.`),
        );
        return;
      }
      if (connection instanceof KdbNode) {
        const connectionString = this.retrieveLocalConnectionString(connection);
        const authCredentials = connection.details.auth
          ? await ext.secretSettings.getAuthData(connection.children[0])
          : undefined;
        const localConnection = new LocalConnection(
          connectionString,
          connLabel,
          retrieveConnLabelsNames(connection),
          authCredentials ? authCredentials.split(":") : undefined,
          connection.details.tls,
        );
        const conn = await localConnection.connect();
        if (conn) {
          notify(
            `Connection established successfully to: ${connLabel}`,
            MessageKind.DEBUG,
            { logger },
          );

          ext.connectedConnectionList.push(localConnection);

          this.connectSuccessBehaviour(connection);
        }
      }
    } catch (error) {
      this.connectFailBehaviour(connLabel, error);
    }
    /* c8 ignore stop */
  }

  public setActiveConnection(node: KdbNode): void {
    const connection = this.retrieveConnectedConnection(node.label);
    if (!connection) {
      return;
    }
    commands.executeCommand("setContext", "kdb.connected.active", [
      `${node.label}`,
    ]);
    notify("Connection activated.", MessageKind.DEBUG, { logger });
    commands.executeCommand("setContext", "kdb.pythonEnabled", true);

    if (ext.activeConnection) {
      ext.activeConnection.setInactive();
    }

    ext.activeConnection = connection;
    ext.connectionNode = node;
    ext.serverProvider.reload();

    ext.activeConnection.setActive();
    setActiveTarget({ kind: "connection", connLabel: node.label });
  }

  // Clears the active connection without disconnecting it — used when a REPL
  // becomes the active target, so no connection shows as active (green).
  public clearActiveConnection(): void {
    if (!ext.activeConnection) {
      return;
    }
    ext.activeConnection.setInactive();
    ext.activeConnection = undefined;
    ext.connectionNode = undefined;
    commands.executeCommand("setContext", "kdb.connected.active", false);
    commands.executeCommand("setContext", "kdb.pythonEnabled", false);
    ext.serverProvider.reload();
  }

  public disconnect(connLabel: string): void {
    const connection = this.retrieveConnectedConnection(connLabel);
    if (!connection) {
      return;
    }
    connection.disconnect();
    this.disconnectBehaviour(connection);
  }

  public async removeConnection(connNode: KdbNode): Promise<void> {
    const isConnected = this.isConnected(connNode.label);
    if (isConnected) {
      this.removeConnectionFromContextString(connNode.label);
      this.disconnect(connNode.label);
    }
    const servers: Server | undefined = getServers();

    const key = getKeyForServerName(connNode.details.serverAlias || "");
    if (servers != undefined && servers[key]) {
      const uServers = Object.keys(servers).filter((server) => {
        return server !== key;
      });

      const updatedServers: Server = {};
      uServers.forEach((server) => {
        updatedServers[server] = servers[server];
      });

      await updateServers(updatedServers);
      ext.serverProvider.refresh(updatedServers);
    }
    notify(`Connection ${connNode.label} removed`, MessageKind.DEBUG, {
      logger,
    });
  }

  public connectSuccessBehaviour(connNode: KdbNode): void {
    ext.latestLblsChanged.length = 0;
    ext.latestLblsChanged.push(...retrieveConnLabelsNames(connNode));
    ext.connectedContextStrings.push(connNode.label);
    commands.executeCommand(
      "setContext",
      "kdb.connected",
      ext.connectedContextStrings,
    );
    this.createConnectionConsole(connNode.label);
    this.setActiveConnection(connNode);
    ext.connectionNode = connNode;
    ext.serverProvider.reload();
  }

  private createConnectionConsole(connLabel: string): void {
    ext.connectionConsoles.get(connLabel)?.dispose();
    const console = new ConnectionConsole(connLabel, () =>
      this.disconnect(connLabel),
    );
    ext.connectionConsoles.set(connLabel, console);
    // Reveal the new console, leaving the caret where it is.
    console.reveal();
  }

  public connectFailBehaviour(connLabel: string, error?: unknown): void {
    notify(`Connection to ${connLabel} failed.`, MessageKind.ERROR, {
      logger,
      params: error,
    });
  }

  public disconnectBehaviour(connection: LocalConnection): void {
    ext.connectionConsoles.get(connection.connLabel)?.dispose();
    ext.connectionConsoles.delete(connection.connLabel);
    ext.connectedConnectionList.splice(
      ext.connectedConnectionList.indexOf(connection),
      1,
    );
    ext.connectedContextStrings.splice(
      ext.connectedContextStrings.indexOf(connection.connLabel),
      1,
    );
    commands.executeCommand(
      "setContext",
      "kdb.connected",
      ext.connectedContextStrings,
    );
    if (ext.activeConnection === connection) {
      ext.activeConnection.setInactive();
      ext.activeConnection = undefined;
      ext.connectionNode = undefined;
      commands.executeCommand("setContext", "kdb.connected.active", false);
      commands.executeCommand("setContext", "kdb.pythonEnabled", false);
    }
    notify(`Connection closed: ${connection.connLabel}`, MessageKind.DEBUG, {
      logger,
    });
    ext.serverProvider.reload();
  }

  public async executeQuery(
    command: string,
    connLabel?: string,
    context?: string,
    stringify?: boolean,
    isPython?: boolean,
    timeout?: number,
    requestID?: string,
  ): Promise<any> {
    let selectedConn;
    if (connLabel) {
      selectedConn = this.retrieveConnectedConnection(connLabel);
    } else {
      if (!ext.activeConnection) {
        return;
      }
      selectedConn = ext.activeConnection;
    }
    if (!selectedConn) {
      return;
    }
    command = sanitizeQuery(command);
    return await selectedConn.executeQuery(
      command,
      context,
      stringify,
      isPython,
    );
  }

  public async retrieveUserPass() {
    for (const connection of ext.connectionsList) {
      if (connection instanceof KdbNode) {
        const authCredentials = await ext.secretSettings.getAuthData(
          connection.children[0],
        );
        if (authCredentials) {
          const [username, password] = authCredentials.split(":");
          const authMap: kdbAuthMap = {
            [connection.children[0]]: {
              username,
              password,
            },
          };
          ext.kdbAuthMap.push(authMap);
        }
      }
    }
  }

  public exportConnection(connLabel?: string, includeAuth?: boolean): string {
    const exportedContent: ExportedConnections = {
      connections: {
        KDB: [],
      },
    };
    if (connLabel) {
      const connection = this.retrieveConnection(connLabel);
      if (!connection) {
        return "";
      }
      if (!isQuickAlias(connection.details.serverAlias))
        exportedContent.connections.KDB.push(connection.details);
    } else {
      ext.connectionsList.forEach((connection) => {
        if (!isQuickAlias(connection.details.serverAlias))
          exportedContent.connections.KDB.push(connection.details);
      });
    }

    if (exportedContent.connections.KDB.length > 0) {
      for (const kdbConn of exportedContent.connections.KDB) {
        if (!includeAuth) {
          kdbConn.auth = false;
          kdbConn.username = undefined;
          kdbConn.password = undefined;
        } else {
          const auth = ext.kdbAuthMap.find((auth) => {
            return Object.keys(auth)[0] === kdbConn.serverAlias;
          });
          if (auth) {
            kdbConn.auth = true;
            kdbConn.username = auth[kdbConn.serverAlias].username;
            kdbConn.password = auth[kdbConn.serverAlias].password;
          }
        }
      }
    }
    ext.kdbAuthMap.length = 0;
    return exportedContent.connections.KDB.length === 0
      ? ""
      : JSON.stringify(exportedContent, null, 2);
  }
}
