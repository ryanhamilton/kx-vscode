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

import * as vscode from "vscode";

import { ext } from "../extensionVariables";
import { ConnectionType } from "../models/connectionsModels";
import { EditConnectionMessage } from "../models/messages";
import { KdbNode } from "../services/kdbTreeProvider";
import {
  clearWorkspaceLabels,
  retrieveConnLabelsNames,
} from "../utils/connLabel";
import { getNonce } from "../utils/getNonce";
import { getUri } from "../utils/uriUtils";
import { webviewReset } from "../utils/webviewPage";

export class NewConnectionPannel {
  public static currentPanel: NewConnectionPannel | undefined;
  private readonly _extensionUri: vscode.Uri;
  public readonly _panel: vscode.WebviewPanel;
  private _disposables: vscode.Disposable[] = [];

  public static render(extensionUri: vscode.Uri, conn?: any) {
    if (NewConnectionPannel.currentPanel) {
      NewConnectionPannel.currentPanel._panel.dispose();
      return;
    }
    clearWorkspaceLabels();

    const panel = vscode.window.createWebviewPanel(
      "kdbNewConnection",
      conn ? "Edit Connection" : "New Connection",
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.joinPath(extensionUri, "out")],
      },
    );

    NewConnectionPannel.currentPanel = new NewConnectionPannel(
      panel,
      extensionUri,
    );

    panel.webview.postMessage({
      command: "refreshLabels",
      data: ext.connLabelList,
      colors: ext.labelColors,
    });

    if (conn) {
      const labels = retrieveConnLabelsNames(conn);
      const connType = this.getConnectionType(conn);
      const editConnData = this.createEditConnectionMessage(conn, connType);
      panel.webview.postMessage({
        command: "editConnection",
        data: editConnData,
        labels,
      });
    }
  }

  public static close() {
    if (NewConnectionPannel.currentPanel) {
      NewConnectionPannel.currentPanel._panel.dispose();
      return;
    }
  }

  public static refreshLabels() {
    if (NewConnectionPannel.currentPanel) {
      NewConnectionPannel.currentPanel._panel.webview.postMessage({
        command: "refreshLabels",
        data: ext.connLabelList,
        colors: ext.labelColors,
      });
    }
  }

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    this._extensionUri = extensionUri;
    this._panel = panel;
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
    this._panel.webview.html = this._getWebviewContent(
      this._panel.webview,
      this._extensionUri,
    );

    this._panel.webview.onDidReceiveMessage((message) => {
      /* c8 ignore start */
      if (message.command === "peachq.connections.add.kdb") {
        vscode.commands.executeCommand(
          "peachq.connections.add.kdb",
          message.data,
          message.labels,
        );
      }
      if (message.command === "peachq.connections.edit.kdb") {
        vscode.commands.executeCommand(
          "peachq.connections.edit.kdb",
          message.data,
          message.oldAlias,
          message.editAuth,
          message.labels,
        );
      }
      if (message.command === "peachq.connections.labels.add") {
        vscode.commands.executeCommand(
          "peachq.connections.labels.add",
          message.data.name,
          message.data.colorName,
        );
        setTimeout(() => {
          this._panel.webview.postMessage({
            command: "refreshLabels",
            data: ext.connLabelList,
            colors: ext.labelColors,
          });
        }, 500);
      }
      /* c8 ignore stop */
    });
  }

  public dispose() {
    NewConnectionPannel.currentPanel = undefined;
    this._panel.dispose();
    while (this._disposables.length) {
      const x = this._disposables.pop();
      if (x) {
        x.dispose();
      }
    }
  }

  private _getWebviewContent(
    webview: vscode.Webview,
    extensionUri: vscode.Uri,
  ) {
    const getResource = (resource: string) =>
      getUri(webview, extensionUri, ["out", resource]);

    return /* html */ `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>New Connection</title>
            ${webviewReset(getNonce())}
            <script type="module" nonce="${getNonce()}" src="${getResource("webview.js")}"></script>
        </head>
        <body>
            <kdb-new-connection-view/>
        </body>
        </html>
        `;
  }

  private static getConnectionType(_conn: KdbNode): ConnectionType {
    return ConnectionType.Kdb;
  }

  private static createEditConnectionMessage(
    conn: KdbNode,
    connType: ConnectionType,
  ): EditConnectionMessage {
    return {
      connType,
      serverName: conn.details.serverAlias,
      serverAddress: conn.details.serverName,
      port: conn.details.serverPort,
      auth: conn.details.auth,
      tls: conn.details.tls,
    };
  }
}
